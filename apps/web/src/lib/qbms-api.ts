export const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export type Role = 'STUDENT' | 'SME' | 'ADMIN';
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'ASSERTION_REASON' | 'MATCHING' | 'ORDERING' | 'READING_COMPREHENSION' | 'DATA_INTERPRETATION' | 'MATHEMATICAL';

export interface Account { id: string; email: string; role: Role; emailVerified: boolean; }
export interface QuestionSummary { id: string; examCycle: { code: string; examination: { code: string; name: string } }; subjectCode: string; versions: Array<{ id: string; version: number; status: string; type: QuestionType; languageCode: string; createdAt: string }>; updatedAt: string; }
export interface ReviewQueueItem { id: string; version: number; status: string; type: QuestionType; languageCode: string; authoredById: string; question: { id: string; subjectCode: string; examCycle: { code: string; examination: { code: string; name: string } } }; reviews?: Array<{ decision: string; reviewerId: string; notes: string }>; }
export interface QuestionDetail { id: string; subjectCode: string; createdById: string; versions: Array<{ id: string; version: number; status: string; type: QuestionType; languageCode: string; prompt: Record<string, unknown>; options: Array<{ id: string; optionKey: string; optionText: unknown; sequence: number }>; answerKeys: Array<{ id: string; correctAnswers: unknown; version: number }>; explanations: Array<{ id: string; explanation: unknown; version: number }>; mappings: Array<{ syllabusTopicId: string }>; provenance: Array<{ sourceTitle: string; rightsStatus: string; sourceType: string }>; translations: Array<{ languageCode: string; status: string }>; }> }
export interface ApiList<T> { data: T[]; pagination?: { page: number; pageSize: number; total: number; totalPages: number }; }

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const message = typeof payload?.message === 'string' ? payload.message : Array.isArray(payload?.message) ? payload.message.join(', ') : `Request failed (${response.status})`; throw new Error(message); }
  return payload as T;
}

export function questionTypeLabel(type: QuestionType) { return type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
