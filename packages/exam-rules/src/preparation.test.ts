import { describe, expect, it } from 'vitest';
import { classifyScoreComparability, evaluateFullMockReadiness, filterHistoricalQuestions, resolveCurrentPattern, resolvePreparationDiscovery, type PreparationPatternCandidate } from './preparation';

const candidate = (overrides: Partial<PreparationPatternCandidate> = {}): PreparationPatternCandidate => ({ id: 'pattern-1', examinationCode: 'UGC_NET', family: 'UGC_NET', cycleCode: '2026-JUNE', subjectCode: 'CS', version: 1, status: 'PUBLISHED', verified: true, effectiveFrom: '2026-01-01T00:00:00Z', evidenceRef: 'official-source-1', ruleHash: 'a'.repeat(64), papers: ['PAPER_I', 'PAPER_II'], ...overrides });

describe('cycle-independent continuous preparation', () => {
  it('allows Paper I preparation without cycle or Paper II subject', () => {
    const result = resolvePreparationDiscovery({ examinationCode: 'UGC_NET', product: 'PAPER_I', asOf: '2026-05-01T00:00:00Z' }, []);
    expect(result.allowed).toBe(true); expect(result.requiresSubject).toBe(false); expect(result.requiresHistoricalCycle).toBe(false);
  });
  it('allows topic practice without cycle or subject and requires subject for Paper II', () => {
    expect(resolvePreparationDiscovery({ examinationCode: 'UGC_NET', product: 'TOPIC_PRACTICE', asOf: '2026-05-01T00:00:00Z' }, []).allowed).toBe(true);
    const result = resolvePreparationDiscovery({ examinationCode: 'UGC_NET', product: 'PAPER_II', asOf: '2026-05-01T00:00:00Z' }, []);
    expect(result.allowed).toBe(false); expect(result.requiresSubject).toBe(true);
  });
  it('resolves one current verified pattern and rejects missing or research-only evidence', () => {
    expect(resolveCurrentPattern({ examinationCode: 'UGC_NET', product: 'FULL_MOCK', subjectCode: 'CS', asOf: '2026-05-01T00:00:00Z', candidates: [candidate()] }).state).toBe('RESOLVED');
    expect(resolveCurrentPattern({ examinationCode: 'UGC_NET', product: 'FULL_MOCK', subjectCode: 'CS', asOf: '2027-05-01T00:00:00Z', candidates: [candidate({ effectiveTo: '2026-12-31T00:00:00Z' })] }).state).toBe('NO_APPLICABLE_PATTERN');
    expect(resolveCurrentPattern({ examinationCode: 'UGC_NET', product: 'FULL_MOCK', subjectCode: 'CS', asOf: '2026-05-01T00:00:00Z', candidates: [candidate({ status: 'RESEARCH_ONLY', verified: false })] }).state).toBe('RESEARCH_ONLY_PATTERN');
  });
  it('rejects ambiguous competing active patterns unless an approved precedence rule resolves them', () => {
    const ambiguous = resolveCurrentPattern({ examinationCode: 'UGC_NET', product: 'PAPER_I', asOf: '2026-05-01T00:00:00Z', candidates: [candidate({ id: 'a', subjectCode: undefined }), candidate({ id: 'b', subjectCode: undefined, version: 2 })] });
    expect(ambiguous.state).toBe('AMBIGUOUS_PATTERN');
    const resolved = resolveCurrentPattern({ examinationCode: 'UGC_NET', product: 'PAPER_I', asOf: '2026-05-01T00:00:00Z', candidates: [candidate({ id: 'a', subjectCode: undefined, precedenceRank: 1, precedenceRuleRef: 'rule-1' }), candidate({ id: 'b', subjectCode: undefined, version: 2 })] });
    expect(resolved.pattern?.id).toBe('a');
  });
  it('keeps historical PYQ filtering separate and rights-safe', () => {
    const items = [{ questionVersionId: 'q2', examinationCode: 'UGC_NET', year: 2025, cycleCode: 'DECEMBER', session: 'SHIFT_1', paper: 'PAPER_I' as const, questionReference: '2', sourceRef: 'source-2', rightsStatus: 'RESEARCH_ONLY' as const }, { questionVersionId: 'q1', examinationCode: 'UGC_NET', year: 2025, cycleCode: 'JUNE', session: 'SHIFT_1', paper: 'PAPER_I' as const, questionReference: '1', sourceRef: 'source-1', rightsStatus: 'CLEARED' as const }];
    expect(filterHistoricalQuestions(items, { year: 2025, paper: 'PAPER_I' }).map((item) => item.questionVersionId)).toEqual(['q1']);
  });
  it('requires both papers, qualified inventory and authorization for a full mock', () => {
    const resolution = resolveCurrentPattern({ examinationCode: 'UGC_NET', product: 'FULL_MOCK', subjectCode: 'CS', asOf: '2026-05-01T00:00:00Z', candidates: [candidate()] });
    expect(evaluateFullMockReadiness({ resolution, papers: ['PAPER_I'], qualifiedQuestionCount: 1, requiredQuestionCount: 2, publicationAuthorized: false }).eligible).toBe(false);
    expect(evaluateFullMockReadiness({ resolution, papers: ['PAPER_I', 'PAPER_II'], qualifiedQuestionCount: 2, requiredQuestionCount: 2, publicationAuthorized: true }).eligible).toBe(true);
  });
  it('does not combine incompatible historical score policies', () => {
    expect(classifyScoreComparability('policy-a', 'policy-a')).toBe('COMPARABLE');
    expect(classifyScoreComparability('policy-a', 'policy-b')).toBe('NOT_COMPARABLE');
    expect(classifyScoreComparability(undefined, 'policy-b')).toBe('UNAVAILABLE');
  });
});
