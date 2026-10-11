import type { AccountRole } from '../generated/prisma/client';

export interface RequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  user?: AuthenticatedUser;
}

export interface CookieResponse {
  setHeader(name: string, value: string): void;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AccountRole;
  emailVerified: boolean;
}

export function requestUserAgent(request: RequestLike): string | undefined {
  const value = request.headers?.['user-agent'];
  return Array.isArray(value) ? value[0] : value;
}

export function requestCookie(request: RequestLike, name: string): string | undefined {
  const direct = request.cookies?.[name];
  if (direct) return direct;
  const header = request.headers?.cookie;
  const raw = Array.isArray(header) ? header.join(';') : header;
  if (!raw) return undefined;
  const pair = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}
