import { hasPublicationMetadata } from './index';
import type { SectionBlueprint, ExamBlueprint } from './index';
import type { BlueprintForForm, PublishedQuestionInput, StudentQuestionProjection, TestFormSnapshot } from './contracts';
export interface FormGenerationRequest { readonly blueprint: BlueprintForForm; readonly inventory: readonly PublishedQuestionInput[]; readonly languageCode: string; readonly seed: string; readonly generatedAt?: string; }
export class FormGenerationError extends Error {}
function hash(input: string): string { let value = 2166136261; for (let i = 0; i < input.length; i += 1) { value ^= input.charCodeAt(i); value = Math.imul(value, 16777619); } return (value >>> 0).toString(16).padStart(8, '0'); }
function random(seed: string): () => number { let state = Number.parseInt(hash(seed), 16) || 1; return () => { state = Math.imul(1664525, state) + 1013904223; return (state >>> 0) / 4294967296; }; }
function shuffled<T>(items: readonly T[], seed: string): T[] { const output = [...items]; const next = random(seed); for (let i = output.length - 1; i > 0; i -= 1) { const j = Math.floor(next() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; } return output; }
function sections(blueprint: ExamBlueprint): { section: SectionBlueprint; key: string; sequence: number }[] { if (blueprint.sessions?.length) return [...blueprint.sessions].sort((a, b) => a.sequence - b.sequence).flatMap((session) => session.sections.map((section) => ({ section, key: `${session.key}.${section.key}`, sequence: session.sequence }))); return blueprint.sections.map((section, sequence) => ({ section, key: section.key, sequence })); }
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value as Record<string, unknown>).forEach((item) => freeze(item)); Object.freeze(value); } return value; }
export function generateTestForm(request: FormGenerationRequest): TestFormSnapshot {
  const { blueprint, inventory, languageCode } = request;
  const evidence = blueprint.evidence;
  const evidenceValid = Boolean(evidence?.officialSourceUrl && evidence.reviewedBy?.trim() && evidence.approvedAt && evidence.regressionReportId?.trim() && evidence.ruleHash?.trim() && (() => { try { return new URL(evidence.officialSourceUrl).protocol === 'https:' && !Number.isNaN(Date.parse(evidence.approvedAt)); } catch { return false; } })());
  if ((!hasPublicationMetadata(blueprint) && blueprint.status !== 'PUBLISHED') || !evidenceValid) throw new FormGenerationError('A documented approved or published blueprint with valid evidence is required');
  if (blueprint.languages && !blueprint.languages.includes(languageCode)) throw new FormGenerationError(`Language is not enabled: ${languageCode}`);
  const selectedSections = sections(blueprint).map(({ section, key, sequence }) => {
    const candidates = shuffled(inventory.filter((question) => question.status === 'PUBLISHED' && question.examCode === blueprint.examCode && question.cycleCode === blueprint.cycleCode && question.subjectCode === blueprint.subjectCode && question.sectionKey === key && question.languageCodes.includes(languageCode) && (!section.questionTypes || section.questionTypes.includes(question.type))), `${request.seed}:${key}`);
    const chosen: PublishedQuestionInput[] = [];
    const usedGroups = new Set<string>();
    for (const candidate of candidates) { if (chosen.length >= section.offeredQuestions) break; if (chosen.some((item) => item.questionVersionId === candidate.questionVersionId)) continue; if (candidate.groupId) { if (usedGroups.has(candidate.groupId)) continue; const group = candidates.filter((item) => item.groupId === candidate.groupId).sort((a, b) => (a.groupSequence ?? 0) - (b.groupSequence ?? 0)); if (chosen.length + group.length > section.offeredQuestions) continue; chosen.push(...group); usedGroups.add(candidate.groupId); } else chosen.push(candidate); }
    if (chosen.length !== section.offeredQuestions) throw new FormGenerationError(`Insufficient complete published questions for section: ${key}`);
    return { key, sequence, questions: chosen.map((question): StudentQuestionProjection => ({ questionVersionId: question.questionVersionId, type: question.type, prompt: question.prompt, options: question.options ?? [], languageCode, ...(question.groupId ? { groupId: question.groupId } : {}), ...(question.content ? { content: question.content } : {}) })) };
  });
  const blueprintSummary = { examCode: blueprint.examCode, cycleCode: blueprint.cycleCode, subjectCode: blueprint.subjectCode, sections: selectedSections.map((section) => ({ key: section.key, sequence: section.sequence, questionVersionIds: section.questions.map((question) => question.questionVersionId) })) };
  const generatedAt = request.generatedAt ?? new Date().toISOString();
  const unsigned = { generatedAt, seed: request.seed, blueprint: blueprintSummary, sections: selectedSections };
  const snapshot = { snapshotId: `form-${hash(JSON.stringify(unsigned))}`, snapshotHash: hash(JSON.stringify(unsigned)), ...unsigned } as TestFormSnapshot;
  return freeze(snapshot);
}
