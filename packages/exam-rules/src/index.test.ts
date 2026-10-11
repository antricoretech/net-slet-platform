import { describe, expect, it } from 'vitest';
import { hasPublicationMetadata, validateBlueprint, type ExamBlueprint } from './index';

const draft: ExamBlueprint = {
  examCode: 'RESEARCH_EXAMPLE', cycleCode: 'UNVERIFIED', subjectCode: 'EXAMPLE', status: 'RESEARCH_ONLY',
  sections: [{ key: 'A', durationSeconds: 600, offeredQuestions: 10, maximumAttempts: 10 }],
};

describe('blueprint guardrails', () => {
  it('accepts structurally sound research blueprints but never auto-publishes', () => {
    expect(validateBlueprint(draft)).toEqual([]);
    expect(hasPublicationMetadata(draft)).toBe(false);
  });
  it('rejects duplicate sections and attempts greater than offered questions', () => {
    expect(validateBlueprint({ ...draft, sections: [draft.sections[0], { key: 'A', durationSeconds: 1, offeredQuestions: 4, maximumAttempts: 5 }] })).toHaveLength(2);
  });
  it('requires review evidence and approval state before publication eligibility', () => {
    const evidence = { officialSourceUrl: 'https://example.edu/official.pdf', reviewedBy: 'reviewer-id', approvedAt: '2026-10-11T00:00:00Z', regressionReportId: 'test-report-001', ruleHash: 'sha256:example-only'  };
    expect(hasPublicationMetadata({ ...draft, status: 'APPROVED' })).toBe(false);
    expect(hasPublicationMetadata({ ...draft, status: 'APPROVED', evidence })).toBe(true);
    expect(hasPublicationMetadata({ ...draft, status: 'PUBLISHED', evidence })).toBe(false);
  });
  it('supports staged OMR sessions and rejects invalid scoring policies', () => {
    const staged = { ...draft, sections: [], sessions: [{ key: 'P1', durationSeconds: 3600, sequence: 0, deliveryMode: 'OMR_SIMULATION' as const, timingPolicy: 'SEQUENTIAL_LOCKED' as const, sections: [{ key: 'PAPER_I', durationSeconds: 3600, offeredQuestions: 50, maximumAttempts: 50, answerPolicy: 'SINGLE_SELECT' as const, marksCorrect: '2.0', marksWrong: '0' }] }] };
    expect(validateBlueprint(staged)).toEqual([]);
    expect(validateBlueprint({ ...staged, sessions: [{ ...staged.sessions[0], sections: [{ ...staged.sessions[0].sections[0], maximumAttempts: 51 }] }] })).toContain('Invalid maximum attempts: P1.PAPER_I');
  });
  it('supports exact-match multi-select policies without floating point assumptions', () => {
    expect(validateBlueprint({ ...draft, sections: [{ ...draft.sections[0], answerPolicy: 'EXACT_MATCH', allowMultipleCorrect: true, marksCorrect: '4.7500', marksWrong: '1.2500' }] })).toEqual([]);
    expect(validateBlueprint({ ...draft, sections: [{ ...draft.sections[0], answerPolicy: 'EXACT_MATCH' }] })).toContain('Exact-match sections must allow multiple correct answers: A');
  });
});
