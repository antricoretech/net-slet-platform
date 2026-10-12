import { describe, expect, it } from 'vitest';
import { calculatePaletteState, FormGenerationError, generateTestForm, remainingSeconds, transitionExam, type ExamBlueprint, type PublishedQuestionInput } from './index';

const blueprint: ExamBlueprint = { examCode: 'NET', cycleCode: '2026', subjectCode: 'CS', status: 'PUBLISHED', languages: ['en-IN'], sections: [{ key: 'paper-1', durationSeconds: 3600, offeredQuestions: 3, maximumAttempts: 3, questionTypes: ['SINGLE_CHOICE'] }], evidence: { officialSourceUrl: 'https://example.edu/pattern', reviewedBy: 'reviewer', approvedAt: '2026-01-01T00:00:00Z', regressionReportId: 'r-1', ruleHash: 'h-1' } };
const inventory: PublishedQuestionInput[] = [1, 2, 3, 4].map((n) => ({ id: `q-${n}`, questionVersionId: `v-${n}`, status: 'PUBLISHED', examCode: 'NET', cycleCode: '2026', subjectCode: 'CS', sectionKey: 'paper-1', type: 'SINGLE_CHOICE', languageCodes: ['en-IN'], prompt: `Question ${n}`, options: [{ id: 'a', label: 'Option A' }] }));

describe('CBT form generation', () => {
  it('selects deterministically and freezes a student-safe snapshot', () => {
    const first = generateTestForm({ blueprint, inventory, languageCode: 'en-IN', seed: 'fixed', generatedAt: '2026-01-01T00:00:00Z' });
    const second = generateTestForm({ blueprint, inventory, languageCode: 'en-IN', seed: 'fixed', generatedAt: '2026-01-01T00:00:00Z' });
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.sections[0].questions).toHaveLength(3);
    expect(first.sections[0].questions[0]).not.toHaveProperty('status');
  });
  it('rejects insufficient published inventory and incomplete groups', () => {
    expect(() => generateTestForm({ blueprint: { ...blueprint, sections: [{ ...blueprint.sections[0], offeredQuestions: 5 }] }, inventory, languageCode: 'en-IN', seed: 'x' })).toThrow(FormGenerationError);
    const grouped = inventory.map((item, index) => ({ ...item, groupId: index < 2 ? 'passage-1' : undefined, groupSequence: index < 2 ? index : undefined }));
    expect(() => generateTestForm({ blueprint, inventory: grouped, languageCode: 'en-IN', seed: 'x' })).not.toThrow();
  });
  it('does not select unpublished, wrong-language or wrong-subject questions', () => {
    const invalid = [...inventory, { ...inventory[0], questionVersionId: 'bad-1', status: 'PUBLISHED', languageCodes: ['hi-IN'] }, { ...inventory[1], questionVersionId: 'bad-2', subjectCode: 'Math' }] as PublishedQuestionInput[];
    const form = generateTestForm({ blueprint, inventory: invalid, languageCode: 'en-IN', seed: 'x' });
    expect(form.sections[0].questions.every((question) => !question.questionVersionId.startsWith('bad'))).toBe(true);
  });
});

describe('CBT state and palette rules', () => {
  it('allows only valid lifecycle transitions and uses server time', () => {
    expect(transitionExam('CREATED', 'READY', new Date())).toBe('READY');
    expect(transitionExam('READY', 'IN_PROGRESS', new Date())).toBe('IN_PROGRESS');
    expect(transitionExam('IN_PROGRESS', 'SUBMITTED', new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:01:00Z'))).toBe('SUBMITTED');
    expect(() => transitionExam('SUBMITTED', 'IN_PROGRESS', new Date())).toThrow();
    expect(() => transitionExam('IN_PROGRESS', 'SUBMITTED', new Date('2026-01-01T00:02:00Z'), new Date('2026-01-01T00:01:00Z'))).toThrow();
    expect(remainingSeconds(new Date('2026-01-01T00:00:10Z'), new Date('2026-01-01T00:00:00Z'))).toBe(10);
  });
  it.each([
    [{ visited: false, hasAnswer: false, markedForReview: false }, 'NOT_VISITED'],
    [{ visited: true, hasAnswer: false, markedForReview: false }, 'VISITED_UNANSWERED'],
    [{ visited: true, hasAnswer: true, markedForReview: false }, 'ANSWERED'],
    [{ visited: true, hasAnswer: false, markedForReview: true }, 'MARKED_REVIEW_UNANSWERED'],
    [{ visited: true, hasAnswer: true, markedForReview: true }, 'MARKED_REVIEW_ANSWERED'],
  ] as const)('calculates %s', (input, expected) => expect(calculatePaletteState(input)).toBe(expected));
});
