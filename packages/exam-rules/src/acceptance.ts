import {
  detectContentDuplicates,
  evaluateContentInventory,
  evaluateRights,
  type InventoryRecord,
  type InventoryRequirement,
  type InventoryScope,
} from './content-quality';

/**
 * Machine-readable Release 1 acceptance metrics for one owner-selected
 * examination/cycle/subject scope. The rules are supplied by the approved
 * blueprint; this module deliberately does not encode question counts.
 */
export interface AcademicInventoryAcceptanceReport {
  readonly scope: InventoryScope;
  readonly totalRequired: number;
  readonly totalAvailable: number;
  readonly totalQualified: number;
  readonly shortfall: number;
  readonly rightsUnverified: number;
  readonly missingAnswerKeys: number;
  readonly missingExplanations: number;
  readonly coverageGaps: readonly {
    readonly requirementId: string;
    readonly label: string;
    readonly required: number;
    readonly available: number;
    readonly missing: number;
    readonly references?: readonly string[];
  }[];
  readonly duplicateWarnings: readonly string[];
  readonly conflictingDuplicates: readonly string[];
  readonly deterministic: true;
}

function inScope(record: InventoryRecord, scope: InventoryScope): boolean {
  return record.examinationCode === scope.examinationCode
    && record.cycleCode === scope.cycleCode
    && record.subjectCode === scope.subjectCode
    && (!scope.sectionKey || record.sectionKey === scope.sectionKey)
    && (!scope.languageCode || record.languageCode === scope.languageCode)
    && (!scope.type || record.type === scope.type)
    && (!scope.difficulty || record.difficulty === scope.difficulty);
}

function requirementInScope(requirement: InventoryRequirement, scope: InventoryScope): boolean {
  return requirement.scope.examinationCode === scope.examinationCode
    && requirement.scope.cycleCode === scope.cycleCode
    && requirement.scope.subjectCode === scope.subjectCode
    && (!scope.sectionKey || !requirement.scope.sectionKey || requirement.scope.sectionKey === scope.sectionKey)
    && (!scope.languageCode || !requirement.scope.languageCode || requirement.scope.languageCode === scope.languageCode)
    && (!scope.type || !requirement.scope.type || requirement.scope.type === scope.type);
}

/** Build explicit acceptance metrics without changing records or using I/O. */
export function buildAcademicInventoryAcceptanceReport(
  scope: InventoryScope,
  records: readonly InventoryRecord[],
  requirements: readonly InventoryRequirement[],
): AcademicInventoryAcceptanceReport {
  const scoped = records.filter((record) => inScope(record, scope));
  const qualified = scoped.filter((record) => {
    const report = evaluateContentInventory(scope, [record], []);
    return report.counts.strictMockEligible === 1;
  });
  const missingAnswerKeys = scoped.filter((record) => !record.answerKeyVersionId?.trim()).length;
  const missingExplanations = scoped.filter((record) => !record.explanation?.explanationVersionId?.trim()).length;
  const rightsUnverified = scoped.filter((record) => !evaluateRights(record.rights, 'strictMock').eligible).length;
  const inventory = evaluateContentInventory(scope, records, requirements);
  const totalRequired = requirements
    .filter((requirement) => requirementInScope(requirement, scope))
    .reduce((total, requirement) => total + requirement.count, 0);
  const conflictingDuplicates = detectContentDuplicates(scoped)
    .filter((finding) => finding.kind === 'CANONICAL_FINGERPRINT' || finding.kind === 'SOURCE_EVENT')
    .filter((finding) => new Set(scoped.filter((record) =>
      (finding.kind === 'CANONICAL_FINGERPRINT' && record.canonicalText === finding.key)
      || (finding.kind === 'SOURCE_EVENT' && record.sourceEventId === finding.key),
    ).map((record) => record.answerKeyVersionId)).size > 1)
    .map((finding) => `${finding.kind}: ${finding.key}`);

  return {
    scope,
    totalRequired,
    totalAvailable: scoped.length,
    totalQualified: qualified.length,
    shortfall: Math.max(0, totalRequired - qualified.length),
    rightsUnverified,
    missingAnswerKeys,
    missingExplanations,
    coverageGaps: inventory.gaps,
    duplicateWarnings: inventory.duplicateWarnings,
    conflictingDuplicates,
    deterministic: true,
  };
}
