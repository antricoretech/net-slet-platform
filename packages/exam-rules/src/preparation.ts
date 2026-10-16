/** Cycle-independent preparation contracts. Historical cycle metadata remains
 * available for evidence, PYQs and pattern governance, but is not required for
 * ordinary student discovery. */

export type PreparationProduct = 'PAPER_I' | 'PAPER_II' | 'TOPIC_PRACTICE' | 'HISTORICAL_PYQ' | 'FULL_MOCK';
export type PreparationResolutionState = 'RESOLVED' | 'NO_APPLICABLE_PATTERN' | 'AMBIGUOUS_PATTERN' | 'RESEARCH_ONLY_PATTERN';

export interface PreparationPatternCandidate {
  readonly id: string;
  readonly examinationCode: string;
  readonly family: string;
  readonly cycleCode: string;
  readonly subjectCode?: string;
  readonly version: number;
  readonly status: 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED' | 'RESEARCH_ONLY';
  readonly verified: boolean;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly evidenceRef: string;
  readonly ruleHash: string;
  readonly papers: readonly ('PAPER_I' | 'PAPER_II')[];
  /** Higher rank is usable only when supplied by an approved precedence rule. */
  readonly precedenceRank?: number;
  readonly precedenceRuleRef?: string;
}

export interface PatternResolution {
  readonly state: PreparationResolutionState;
  readonly pattern?: PreparationPatternCandidate;
  readonly candidates: readonly string[];
  readonly reasons: readonly string[];
}

export interface PreparationRequest {
  readonly examinationCode: string;
  readonly product: PreparationProduct;
  readonly subjectCode?: string;
  readonly cycleCode?: string;
  readonly asOf: string;
}

function activeAt(candidate: PreparationPatternCandidate, asOf: number): boolean {
  const from = Date.parse(candidate.effectiveFrom);
  const to = candidate.effectiveTo ? Date.parse(candidate.effectiveTo) : Number.POSITIVE_INFINITY;
  return !Number.isNaN(from) && !Number.isNaN(to) && from <= asOf && asOf < to;
}

function hasEvidence(candidate: PreparationPatternCandidate): boolean {
  return candidate.verified && !!candidate.evidenceRef.trim() && /^[a-f0-9]{64}$/i.test(candidate.ruleHash);
}

/** Resolve the applicable current pattern without requiring a cycle selection. */
export function resolveCurrentPattern(input: {
  readonly examinationCode: string;
  readonly subjectCode?: string;
  readonly product: PreparationProduct;
  readonly asOf: string;
  readonly candidates: readonly PreparationPatternCandidate[];
}): PatternResolution {
  const asOf = Date.parse(input.asOf);
  if (Number.isNaN(asOf)) return { state: 'NO_APPLICABLE_PATTERN', candidates: [], reasons: ['A valid resolution timestamp is required.'] };
  const subjectRequired = input.product === 'PAPER_II' || input.product === 'FULL_MOCK';
  if (subjectRequired && !input.subjectCode?.trim()) return { state: 'NO_APPLICABLE_PATTERN', candidates: [], reasons: ['A Paper II subject is required for this preparation product.'] };
  const scoped = input.candidates.filter((candidate) => candidate.examinationCode === input.examinationCode && (!candidate.subjectCode || candidate.subjectCode === input.subjectCode) && candidate.status !== 'SUPERSEDED' && activeAt(candidate, asOf));
  const researchOnly = scoped.filter((candidate) => candidate.status === 'RESEARCH_ONLY' || !hasEvidence(candidate));
  const eligible = scoped.filter((candidate) => (candidate.status === 'APPROVED' || candidate.status === 'PUBLISHED') && hasEvidence(candidate));
  if (!eligible.length) return { state: researchOnly.length ? 'RESEARCH_ONLY_PATTERN' : 'NO_APPLICABLE_PATTERN', candidates: scoped.map((candidate) => candidate.id).sort(), reasons: [researchOnly.length ? 'Only research-only or unverified patterns are applicable.' : 'No verified approved pattern is applicable at this date.'] };
  const ranked = [...eligible].sort((left, right) => (right.precedenceRank ?? 0) - (left.precedenceRank ?? 0));
  const highestRank = ranked[0].precedenceRank ?? 0;
  const highest = ranked.filter((candidate) => (candidate.precedenceRank ?? 0) === highestRank);
  if (highest.length > 1) return { state: 'AMBIGUOUS_PATTERN', candidates: highest.map((candidate) => candidate.id).sort(), reasons: ['Multiple verified active patterns have equal precedence; an approved precedence rule is required.'] };
  if (highest[0].precedenceRank !== undefined && !highest[0].precedenceRuleRef?.trim()) return { state: 'AMBIGUOUS_PATTERN', candidates: [highest[0].id], reasons: ['A precedence rank cannot be used without its approved precedence-rule reference.'] };
  return { state: 'RESOLVED', pattern: highest[0], candidates: eligible.map((candidate) => candidate.id).sort(), reasons: [] };
}

export interface PreparationDiscovery {
  readonly allowed: boolean;
  readonly requiresSubject: boolean;
  readonly requiresHistoricalCycle: boolean;
  readonly patternResolution: PatternResolution;
  readonly reasons: readonly string[];
}

export function resolvePreparationDiscovery(request: PreparationRequest, candidates: readonly PreparationPatternCandidate[]): PreparationDiscovery {
  const requiresSubject = request.product === 'PAPER_II' || request.product === 'FULL_MOCK';
  const requiresHistoricalCycle = request.product === 'HISTORICAL_PYQ';
  const resolution = resolveCurrentPattern({ ...request, candidates });
  const reasons = [...resolution.reasons];
  if (request.product === 'HISTORICAL_PYQ') return { allowed: true, requiresSubject: false, requiresHistoricalCycle, patternResolution: resolution, reasons };
  if (request.product === 'PAPER_I' || request.product === 'TOPIC_PRACTICE') return { allowed: true, requiresSubject: false, requiresHistoricalCycle: false, patternResolution: resolution, reasons };
  if (resolution.state !== 'RESOLVED') reasons.push('Pattern-dependent preparation cannot continue without one applicable verified pattern.');
  return { allowed: resolution.state === 'RESOLVED', requiresSubject, requiresHistoricalCycle: false, patternResolution: resolution, reasons: [...new Set(reasons)] };
}

export interface HistoricalQuestionMetadata {
  readonly questionVersionId: string;
  readonly examinationCode: string;
  readonly year: number;
  readonly cycleCode: string;
  readonly session?: string;
  readonly paper: 'PAPER_I' | 'PAPER_II';
  readonly subjectCode?: string;
  readonly questionReference: string;
  readonly sourceRef: string;
  readonly rightsStatus: 'CLEARED' | 'RESEARCH_ONLY' | 'UNKNOWN' | 'RESTRICTED';
}

export interface HistoricalQuestionFilter { readonly year?: number; readonly cycleCode?: string; readonly session?: string; readonly paper?: HistoricalQuestionMetadata['paper']; readonly subjectCode?: string; }
export function filterHistoricalQuestions(items: readonly HistoricalQuestionMetadata[], filter: HistoricalQuestionFilter): readonly HistoricalQuestionMetadata[] {
  return items.filter((item) => item.rightsStatus === 'CLEARED' && (!filter.year || item.year === filter.year) && (!filter.cycleCode || item.cycleCode === filter.cycleCode) && (!filter.session || item.session === filter.session) && (!filter.paper || item.paper === filter.paper) && (!filter.subjectCode || item.subjectCode === filter.subjectCode)).sort((left, right) => left.questionVersionId.localeCompare(right.questionVersionId));
}

export interface FullMockReadinessInput { readonly resolution: PatternResolution; readonly papers: readonly ('PAPER_I' | 'PAPER_II')[]; readonly qualifiedQuestionCount: number; readonly requiredQuestionCount: number; readonly publicationAuthorized: boolean; }
export interface FullMockReadiness { readonly eligible: boolean; readonly reasons: readonly string[]; }
export function evaluateFullMockReadiness(input: FullMockReadinessInput): FullMockReadiness {
  const reasons: string[] = [];
  if (input.resolution.state !== 'RESOLVED') reasons.push('An applicable verified pattern is required.');
  if (!input.papers.includes('PAPER_I') || !input.papers.includes('PAPER_II')) reasons.push('A full mock requires both Paper I and Paper II.');
  if (input.qualifiedQuestionCount < input.requiredQuestionCount) reasons.push('Qualified question inventory is insufficient.');
  if (!input.publicationAuthorized) reasons.push('Publication authorization is required.');
  return { eligible: reasons.length === 0, reasons };
}

export type ScoreComparability = 'COMPARABLE' | 'NOT_COMPARABLE' | 'UNAVAILABLE';
export function classifyScoreComparability(leftPolicyRef: string | undefined, rightPolicyRef: string | undefined): ScoreComparability {
  if (!leftPolicyRef || !rightPolicyRef) return 'UNAVAILABLE';
  return leftPolicyRef === rightPolicyRef ? 'COMPARABLE' : 'NOT_COMPARABLE';
}
