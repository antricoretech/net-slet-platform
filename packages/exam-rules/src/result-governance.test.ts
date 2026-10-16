import { describe, expect, it } from 'vitest';
import { canRescorePinnedForm, resultDisclosurePolicy } from './result-governance';

describe('result governance contracts', () => {
  it('pending results disclose aggregate score only', () => {
    expect(resultDisclosurePolicy('PENDING')).toEqual({ aggregateScore: true, questionCorrectness: false, answerKeys: false, explanations: false, learningEvidence: false });
  });

  it('published results disclose approved explanations and learning evidence, never answer keys', () => {
    expect(resultDisclosurePolicy('PUBLISHED')).toEqual({ aggregateScore: true, questionCorrectness: true, answerKeys: false, explanations: true, learningEvidence: true });
  });

  it('rescore requires the correction to match the immutable form pin', () => {
    expect(canRescorePinnedForm('key-v1', 'key-v1', 'key-v1')).toBe(true);
    expect(canRescorePinnedForm('key-v1', 'key-v2', 'key-v1')).toBe(false);
    expect(canRescorePinnedForm('key-v1', 'key-v1', 'key-v2')).toBe(false);
  });
});
