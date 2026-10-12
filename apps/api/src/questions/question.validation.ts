import { BadRequestException } from '@nestjs/common';
import { QuestionType } from '../generated/prisma/client';

export interface QuestionOptionInput { optionKey: string; optionText: unknown; sequence: number; }
export interface AnswerKeyInput { correctAnswers: unknown; exactMatch?: boolean; }

const QUESTION_TYPES = Object.values(QuestionType);

export function validateQuestionPayload(type: QuestionType, prompt: unknown, options: QuestionOptionInput[]): void {
  if (!QUESTION_TYPES.includes(type) || !isObject(prompt)) throw new BadRequestException('Invalid question type or prompt');
  const promptRecord = prompt as Record<string, unknown>;
  if (typeof promptRecord.text !== 'string' || !promptRecord.text.trim() || promptRecord.text.length > 20_000) throw new BadRequestException('Question prompt text is required');
  if (/<\s*script\b|javascript:/i.test(JSON.stringify(prompt))) throw new BadRequestException('Executable content is not allowed');
  const keys = new Set<string>();
  const sequences = new Set<number>();
  for (const option of options) {
    if (!/^[A-Z0-9][A-Z0-9_.-]{0,31}$/.test(option.optionKey) || keys.has(option.optionKey) || !Number.isSafeInteger(option.sequence) || option.sequence < 0 || sequences.has(option.sequence) || !isSafeJson(option.optionText)) throw new BadRequestException('Invalid or duplicate question option');
    keys.add(option.optionKey);
    sequences.add(option.sequence);
  }
  if (([QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE, QuestionType.ASSERTION_REASON] as QuestionType[]).includes(type) && options.length < 2) throw new BadRequestException('Choice questions require at least two options');
  if (type === QuestionType.ASSERTION_REASON && (!isObject(promptRecord.assertion) || !isObject(promptRecord.reason))) throw new BadRequestException('Assertion and reason structures are required');
  if (type === QuestionType.MATCHING && (!arrayOfRecords(promptRecord.leftItems) || !arrayOfRecords(promptRecord.rightItems))) throw new BadRequestException('Matching questions require leftItems and rightItems');
  if (type === QuestionType.ORDERING && (!Array.isArray(promptRecord.items) || promptRecord.items.length < 2)) throw new BadRequestException('Ordering questions require at least two items');
  if (([QuestionType.READING_COMPREHENSION, QuestionType.DATA_INTERPRETATION] as QuestionType[]).includes(type) && (typeof promptRecord.groupId !== 'string' || !promptRecord.groupId.trim())) throw new BadRequestException('Shared-passage questions require a groupId');
  if (type === QuestionType.MATHEMATICAL && typeof promptRecord.latex !== 'string' && typeof promptRecord.text !== 'string') throw new BadRequestException('Mathematical questions require text or LaTeX');
}

export function validateAnswerKey(type: QuestionType, key: AnswerKeyInput, options: QuestionOptionInput[]): void {
  if (!isObject(key)) throw new BadRequestException('Answer key is required');
  if (type === QuestionType.MATCHING) {
    if (!isObject(key.correctAnswers) || Object.keys(key.correctAnswers).length < 2 || Object.values(key.correctAnswers).some((value) => typeof value !== 'string' || !value.trim())) throw new BadRequestException('Matching questions require a non-empty mapping');
    return;
  }
  if (!Array.isArray(key.correctAnswers)) throw new BadRequestException('Answer key must contain an array of correctAnswers');
  const available = new Set(options.map((option) => option.optionKey));
  const answers = key.correctAnswers;
  if (answers.some((answer) => typeof answer !== 'string' || !available.has(answer)) || new Set(answers).size !== answers.length) throw new BadRequestException('Answer key references invalid or duplicate options');
  if (type === QuestionType.SINGLE_CHOICE && answers.length !== 1) throw new BadRequestException('Single-correct questions require exactly one answer');
  if (type === QuestionType.MULTIPLE_CHOICE && answers.length < 1) throw new BadRequestException('Multiple-correct questions require at least one answer');
  if (type === QuestionType.ORDERING && answers.length < 2) throw new BadRequestException('Ordering questions require a complete ordering');
}

export function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function isSafeJson(value: unknown): boolean { try { JSON.stringify(value); return !/<\s*script\b|javascript:/i.test(JSON.stringify(value)); } catch { return false; } }
function arrayOfRecords(value: unknown): boolean { return Array.isArray(value) && value.length >= 2 && value.every(isObject); }
