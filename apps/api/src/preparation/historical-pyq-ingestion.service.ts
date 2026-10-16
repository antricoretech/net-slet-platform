import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuditEventType, HistoricalMetadataImportRowStatus, HistoricalMetadataImportStatus, Prisma, RightsStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { HISTORICAL_PYQ_DISCOVERY_USE, type HistoricalRightsScope } from './eligibility';

export type HistoricalPyqImportRecord = Record<string, unknown>;
export type HistoricalPyqImportInput = { sourceName: string; sourceChecksum: string; format: 'JSON' | 'CSV'; records?: unknown; csv?: string };

const SHA256 = /^[a-f0-9]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const REQUIRED_CSV_HEADERS = ['questionVersionId', 'sourceChecksum'];
const CLEARED_RIGHTS = new Set<RightsStatus>([RightsStatus.OWNED, RightsStatus.LICENSED, RightsStatus.PERMISSION_GRANTED, RightsStatus.PUBLIC_DOMAIN]);

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

function fingerprint(value: unknown) { return createHash('sha256').update(stable(value)).digest('hex'); }

function csvRecords(source: string): HistoricalPyqImportRecord[] {
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) throw new BadRequestException('CSV input exceeds the 2 MiB upload limit');
  const rows: string[][] = [];
  let cells: string[] = [];
  let current = '';
  let quoted = false;
  let afterQuote = false;
  const pushCell = () => { cells.push(current.trim()); current = ''; afterQuote = false; };
  const pushRow = () => { if (cells.some((cell) => cell.length) || current.length) { pushCell(); rows.push(cells); cells = []; } };
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { current += '"'; index++; }
      else if (character === '"') { quoted = false; afterQuote = true; }
      else current += character;
      continue;
    }
    if (afterQuote) {
      if (character === ',') pushCell();
      else if (character === '\r' || character === '\n') { pushRow(); if (character === '\r' && source[index + 1] === '\n') index++; }
      else if (!/\s/.test(character)) throw new BadRequestException('Malformed CSV: unexpected characters after a quoted field');
      continue;
    }
    if (character === '"' && current.trim() === '') quoted = true;
    else if (character === ',') pushCell();
    else if (character === '\r' || character === '\n') { pushRow(); if (character === '\r' && source[index + 1] === '\n') index++; }
    else current += character;
  }
  if (quoted) throw new BadRequestException('Malformed CSV: unterminated quoted field');
  if (current.length || cells.length) pushRow();
  if (!rows.length) return [];
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim());
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  if (headers.some((header) => !header) || new Set(normalizedHeaders).size !== headers.length) throw new BadRequestException('CSV headers must be non-empty and unique');
  const missing = REQUIRED_CSV_HEADERS.filter((header) => !normalizedHeaders.includes(header.toLowerCase()));
  if (missing.length) throw new BadRequestException(`CSV required headers missing: ${missing.join(', ')}`);
  return rows.slice(1).map((row, rowIndex) => {
    if (row.length !== headers.length) throw new BadRequestException(`Malformed CSV row ${rowIndex + 2}: column count does not match headers`);
    const record = Object.fromEntries(row.map((value, index) => [headers[index], value]));
    if (typeof record.rightsScope === 'string' && record.rightsScope.trim()) {
      try { record.rightsScope = JSON.parse(record.rightsScope); } catch { throw new BadRequestException(`Malformed CSV row ${rowIndex + 2}: rightsScope must be valid JSON`); }
    }
    return record;
  });
}

function recordsFromInput(input: HistoricalPyqImportInput): HistoricalPyqImportRecord[] {
  if (input.format === 'CSV') { if (typeof input.csv !== 'string') throw new BadRequestException('CSV input is required'); return csvRecords(input.csv); }
  if (!Array.isArray(input.records)) throw new BadRequestException('JSON records must be an array');
  if (input.records.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) throw new BadRequestException('Every JSON record must be an object');
  return input.records as HistoricalPyqImportRecord[];
}

function contentChecksum(records: HistoricalPyqImportRecord[]) {
  const canonicalRecords = records.map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'sourceChecksum')));
  return createHash('sha256').update(Buffer.from(stable(canonicalRecords), 'utf8')).digest('hex');
}

function stringField(record: HistoricalPyqImportRecord, key: string) { const value = record[key]; return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function scopeField(record: HistoricalPyqImportRecord): HistoricalRightsScope | undefined { const value = record.rightsScope; return value && typeof value === 'object' && !Array.isArray(value) ? value as HistoricalRightsScope : undefined; }

@Injectable()
export class HistoricalPyqIngestionService {
  constructor(private readonly database: PrismaService) {}

  async dryRun(actorId: string, input: HistoricalPyqImportInput) {
    if (!input || typeof input.sourceName !== 'string' || !input.sourceName.trim()) throw new BadRequestException('sourceName is required');
    if (!input || typeof input.sourceChecksum !== 'string' || !SHA256.test(input.sourceChecksum.trim())) throw new BadRequestException('sourceChecksum must be a SHA-256 hex digest');
    if (input.format !== 'JSON' && input.format !== 'CSV') throw new BadRequestException('format must be JSON or CSV');
    const records = recordsFromInput(input);
    const normalized = { sourceName: input.sourceName?.trim(), sourceChecksum: input.sourceChecksum?.trim().toLowerCase(), format: input.format, records };
    if (normalized.sourceChecksum !== contentChecksum(records)) throw new BadRequestException('sourceChecksum does not match the canonical source payload');
    const manifestHash = fingerprint(normalized);
    const existing = await this.database.historicalMetadataImport.findUnique({ where: { manifestHash }, select: { id: true, status: true, rowCount: true, acceptedCount: true, rejectedCount: true, duplicateCount: true } });
    if (existing) return { manifestId: existing.id, manifestHash, idempotent: true, ...existing };
    const validation = await this.validate(normalized);
    let created;
    try {
      created = await this.database.$transaction(async (tx) => {
        const manifest = await tx.historicalMetadataImport.create({ data: { manifestHash, sourceName: normalized.sourceName, sourceChecksum: normalized.sourceChecksum, format: normalized.format, status: validation.rejectedCount ? HistoricalMetadataImportStatus.PARTIAL_REJECTED : HistoricalMetadataImportStatus.VALIDATED, rowCount: records.length, acceptedCount: validation.acceptedCount, rejectedCount: validation.rejectedCount, duplicateCount: validation.duplicateCount, createdById: actorId, rows: { create: validation.rows.map((row) => ({ rowNumber: row.rowNumber, questionVersionId: row.questionVersionId, fingerprint: row.fingerprint, payload: row.payload as Prisma.InputJsonValue, status: row.status, rejectionReasons: row.reasons.length ? row.reasons : undefined })) } } });
        await tx.auditEvent.create({ data: { type: validation.rejectedCount ? AuditEventType.HISTORICAL_METADATA_IMPORT_REJECTED : AuditEventType.HISTORICAL_METADATA_IMPORT_DRY_RUN, accountId: actorId, metadata: { manifestId: manifest.id, manifestHash, rowCount: records.length, acceptedCount: validation.acceptedCount, rejectedCount: validation.rejectedCount, duplicateCount: validation.duplicateCount } } });
        return manifest;
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const raced = await this.database.historicalMetadataImport.findUnique({ where: { manifestHash }, select: { id: true, status: true, rowCount: true, acceptedCount: true, rejectedCount: true, duplicateCount: true } });
      if (!raced) throw error;
      return { manifestId: raced.id, manifestHash, idempotent: true, ...raced };
    }
    return { manifestId: created.id, manifestHash, status: created.status, rowCount: created.rowCount, acceptedCount: created.acceptedCount, rejectedCount: created.rejectedCount, duplicateCount: created.duplicateCount, rows: validation.rows.map(({ rowNumber, status, reasons }) => ({ rowNumber, status, reasons })) };
  }

  async commit(actorId: string, manifestId: string) {
    if (!UUID.test(manifestId)) throw new BadRequestException('Invalid manifest id');
    return this.database.$transaction(async (tx) => {
      const manifest = await tx.historicalMetadataImport.findUnique({ where: { id: manifestId }, include: { rows: true } });
      if (!manifest) throw new BadRequestException('Import manifest not found');
      if (manifest.createdById !== actorId) throw new ConflictException('Only the manifest owner may commit this import');
      if (manifest.status === HistoricalMetadataImportStatus.COMMITTED) return { manifestId, status: manifest.status, idempotent: true, acceptedCount: manifest.acceptedCount, duplicateCount: manifest.duplicateCount };
      const accepted = manifest.rows.filter((row) => row.status === HistoricalMetadataImportRowStatus.ACCEPTED);
      let committed = 0; let duplicates = manifest.duplicateCount;
      for (const row of accepted) {
        const payload = row.payload as HistoricalPyqImportRecord;
        const existing = row.questionVersionId ? await tx.historicalQuestionMetadata.findUnique({ where: { questionVersionId: row.questionVersionId }, select: { id: true, metadataFingerprint: true } }) : null;
        if (existing) {
          if (existing.metadataFingerprint !== row.fingerprint) throw new ConflictException(`Question version ${row.questionVersionId} already has different historical metadata`);
          await tx.historicalMetadataImportRow.update({ where: { id: row.id }, data: { metadataId: existing.id, status: HistoricalMetadataImportRowStatus.DUPLICATE } }); duplicates++; continue;
        }
        const created = await tx.historicalQuestionMetadata.create({ data: { questionVersionId: row.questionVersionId!, examCycleId: String(payload.examCycleId), examinationFamily: String(payload.examinationFamily) as never, authority: String(payload.authority), sourceYear: Number(payload.sourceYear), historicalCycle: stringField(payload, 'historicalCycle'), session: stringField(payload, 'session'), paper: stringField(payload, 'paper'), subjectCode: String(payload.subjectCode).trim().toUpperCase(), questionPaperReference: stringField(payload, 'questionPaperReference'), questionSequence: payload.questionSequence == null ? undefined : Number(payload.questionSequence), languageCode: String(payload.languageCode).trim().toLowerCase(), sourceReference: String(payload.sourceReference), sourceChecksum: String(payload.sourceChecksum).toLowerCase(), answerKeyProvenance: stringField(payload, 'answerKeyProvenance'), rightsStatus: String(payload.rightsStatus) as RightsStatus, rightsScope: payload.rightsScope as Prisma.InputJsonValue, rightsEvidenceReference: stringField(payload, 'rightsEvidenceReference'), rightsExpiresAt: stringField(payload, 'rightsExpiresAt') ? new Date(String(payload.rightsExpiresAt)) : undefined, rightsLicenceId: stringField(payload, 'rightsLicenceId'), metadataFingerprint: row.fingerprint } });
        await tx.historicalMetadataImportRow.update({ where: { id: row.id }, data: { metadataId: created.id } }); committed++;
      }
      const status = manifest.rejectedCount ? HistoricalMetadataImportStatus.PARTIAL_REJECTED : HistoricalMetadataImportStatus.COMMITTED;
      await tx.historicalMetadataImport.update({ where: { id: manifestId }, data: { status, duplicateCount: duplicates, committedAt: new Date() } });
      await tx.auditEvent.create({ data: { type: AuditEventType.HISTORICAL_METADATA_IMPORT_COMMITTED, accountId: actorId, metadata: { manifestId, committed, duplicateCount: duplicates, status } } });
      return { manifestId, status, committed, duplicateCount: duplicates, publicationEligible: false, verificationStatus: 'UNVERIFIED' };
    });
  }

  private async validate(input: { sourceName: string; sourceChecksum: string; format: string; records: HistoricalPyqImportRecord[] }) {
    const now = new Date();
    const ids = input.records.map((record) => stringField(record, 'questionVersionId')).filter((value): value is string => Boolean(value));
    const questions = await this.database.questionVersion.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        languageCode: true,
        question: { select: { subjectCode: true, examCycleId: true, examCycle: { select: { code: true, examination: { select: { family: true } } } } } },
        translations: { where: { status: 'APPROVED' }, select: { languageCode: true } },
      },
    });
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const existing = await this.database.historicalQuestionMetadata.findMany({ where: { questionVersionId: { in: ids } }, select: { questionVersionId: true, metadataFingerprint: true, id: true } });
    const existingByQuestion = new Map(existing.map((item) => [item.questionVersionId, item]));
    const licenceIds = input.records.map((record) => stringField(record, 'rightsLicenceId')).filter((value): value is string => Boolean(value));
    const licences = await this.database.contentLicence.findMany({ where: { id: { in: licenceIds } }, select: { id: true, questionVersionId: true } });
    const licenceById = new Map(licences.map((licence) => [licence.id, licence]));
    const seen = new Set<string>();
    const rows = input.records.map((record, index) => {
      const reasons: string[] = []; const questionVersionId = stringField(record, 'questionVersionId'); const rowFingerprint = fingerprint(record); const scope = scopeField(record); const rightsStatus = stringField(record, 'rightsStatus'); const languageCode = stringField(record, 'languageCode')?.toLowerCase(); const question = questionVersionId ? questionById.get(questionVersionId) : undefined;
      if (!questionVersionId || !UUID.test(questionVersionId)) reasons.push('QUESTION_VERSION_ID_INVALID');
      if (!question) reasons.push('QUESTION_VERSION_NOT_FOUND');
      if (questionVersionId && seen.has(questionVersionId)) reasons.push('DUPLICATE_IN_IMPORT'); else if (questionVersionId) seen.add(questionVersionId);
      if (!SHA256.test(input.sourceChecksum)) reasons.push('MANIFEST_CHECKSUM_INVALID');
      if (stringField(record, 'sourceChecksum')?.toLowerCase() !== input.sourceChecksum) reasons.push('ROW_CHECKSUM_DOES_NOT_MATCH_MANIFEST');
      if (!stringField(record, 'sourceName') && !input.sourceName) reasons.push('SOURCE_NAME_MISSING');
      if (!stringField(record, 'authority')) reasons.push('AUTHORITY_MISSING');
      if (!stringField(record, 'sourceReference')) reasons.push('SOURCE_REFERENCE_MISSING');
      if (!stringField(record, 'examCycleId') || !UUID.test(stringField(record, 'examCycleId')!)) reasons.push('EXAM_CYCLE_ID_INVALID');
      if (question && stringField(record, 'examCycleId') !== question.question.examCycleId) reasons.push('EXAM_CYCLE_MISMATCH');
      if (!languageCode) reasons.push('LANGUAGE_MISSING');
      if (question && languageCode && question.languageCode.toLowerCase() !== languageCode && !question.translations.some((translation) => translation.languageCode.toLowerCase() === languageCode)) reasons.push('LANGUAGE_NOT_AUTHORIZED_FOR_QUESTION');
      const year = Number(record.sourceYear); if (!Number.isInteger(year) || year < 1900 || year > now.getUTCFullYear() + 1) reasons.push('SOURCE_YEAR_INVALID');
      if (!stringField(record, 'historicalCycle')) reasons.push('HISTORICAL_CYCLE_MISSING');
      if (!stringField(record, 'session')) reasons.push('SESSION_MISSING');
      if (!stringField(record, 'paper')) reasons.push('PAPER_MISSING');
      if (!stringField(record, 'subjectCode')) reasons.push('SUBJECT_MISSING');
      if (question && stringField(record, 'subjectCode')?.toUpperCase() !== question.question.subjectCode.toUpperCase()) reasons.push('SUBJECT_MISMATCH');
      if (!stringField(record, 'examinationFamily') || stringField(record, 'examinationFamily') !== question?.question.examCycle.examination.family) reasons.push('EXAMINATION_FAMILY_MISMATCH');
      if (!rightsStatus || !Object.values(RightsStatus).includes(rightsStatus as RightsStatus) || !CLEARED_RIGHTS.has(rightsStatus as RightsStatus)) reasons.push('RIGHTS_NOT_CLEARED');
      if (!scope || !Array.isArray(scope.allowedUses) || !scope.allowedUses.includes(HISTORICAL_PYQ_DISCOVERY_USE) || !Array.isArray(scope.languages) || !languageCode || !(scope.languages.includes('*') || scope.languages.some((value) => String(value).toLowerCase() === languageCode))) reasons.push('RIGHTS_SCOPE_INCOMPLETE');
      const expiresAt = stringField(record, 'rightsExpiresAt'); if (expiresAt && (Number.isNaN(Date.parse(expiresAt)) || new Date(expiresAt) <= now)) reasons.push('RIGHTS_EXPIRY_INVALID');
      if (!stringField(record, 'rightsEvidenceReference') && !stringField(record, 'rightsLicenceId')) reasons.push('RIGHTS_EVIDENCE_MISSING');
      const rightsLicenceId = stringField(record, 'rightsLicenceId'); if (rightsLicenceId && (!licenceById.has(rightsLicenceId) || licenceById.get(rightsLicenceId)?.questionVersionId !== questionVersionId)) reasons.push('RIGHTS_LICENCE_MISMATCH');
      const prior = questionVersionId ? existingByQuestion.get(questionVersionId) : undefined; if (prior && prior.metadataFingerprint !== rowFingerprint) reasons.push('QUESTION_VERSION_ALREADY_HAS_DIFFERENT_METADATA');
      const duplicate = prior && prior.metadataFingerprint === rowFingerprint && reasons.length === 0;
      return { rowNumber: index + 1, questionVersionId, fingerprint: rowFingerprint, payload: record, status: duplicate ? HistoricalMetadataImportRowStatus.DUPLICATE : reasons.length ? HistoricalMetadataImportRowStatus.REJECTED : HistoricalMetadataImportRowStatus.ACCEPTED, reasons };
    });
    return { rows, acceptedCount: rows.filter((row) => row.status === HistoricalMetadataImportRowStatus.ACCEPTED).length, rejectedCount: rows.filter((row) => row.status === HistoricalMetadataImportRowStatus.REJECTED).length, duplicateCount: rows.filter((row) => row.status === HistoricalMetadataImportRowStatus.DUPLICATE).length };
  }
}
