import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class RequestOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method?: string; headers?: Record<string, string | string[] | undefined> }>();
    if (SAFE_METHODS.has(request.method?.toUpperCase() ?? '')) return true;
    const origin = this.header(request.headers?.origin);
    if (!origin) return true;
    const configured = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    if (configured.includes(origin)) return true;
    throw new ForbiddenException('Request origin is not allowed');
  }

  private header(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
}
