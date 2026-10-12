import { BadRequestException } from '@nestjs/common';
import { QuestionType } from '../generated/prisma/client';
import { validateAnswerKey, validateQuestionPayload, type QuestionOptionInput } from './question.validation';

const options: QuestionOptionInput[] = [{ optionKey: 'A', optionText: { text: 'One' }, sequence: 0 }, { optionKey: 'B', optionText: { text: 'Two' }, sequence: 1 }];
const base = { text: 'A reviewed question' };

describe('question authoring validation', () => {
  it.each(Object.values(QuestionType))('represents %s', (type) => {
    const prompt = type === QuestionType.ASSERTION_REASON ? { ...base, assertion: { text: 'A' }, reason: { text: 'B' } } : type === QuestionType.MATCHING ? { ...base, leftItems: [{ id: 'L1' }, { id: 'L2' }], rightItems: [{ id: 'R1' }, { id: 'R2' }] } : type === QuestionType.ORDERING ? { ...base, items: ['A', 'B'] } : ([QuestionType.READING_COMPREHENSION, QuestionType.DATA_INTERPRETATION] as QuestionType[]).includes(type) ? { ...base, groupId: 'group' } : type === QuestionType.MATHEMATICAL ? { ...base, latex: 'x^2' } : base;
    expect(() => validateQuestionPayload(type, prompt, options)).not.toThrow();
  });

  it('rejects multiple answers for a single-correct question', () => expect(() => validateAnswerKey(QuestionType.SINGLE_CHOICE, { correctAnswers: ['A', 'B'] }, options)).toThrow(BadRequestException));
  it('rejects nonexistent option identifiers', () => expect(() => validateAnswerKey(QuestionType.MULTIPLE_CHOICE, { correctAnswers: ['C'] }, options)).toThrow(BadRequestException));
  it('rejects executable prompt content', () => expect(() => validateQuestionPayload(QuestionType.SINGLE_CHOICE, { text: '<script>alert(1)</script>' }, options)).toThrow(BadRequestException));
});
