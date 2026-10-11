import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountRole, AuditEventType } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RequestLike } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly database: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AccountRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (!request.user || !required.includes(request.user.role)) {
      await this.database.auditEvent.create({ data: { type: AuditEventType.ROLE_ACCESS_DENIED, accountId: request.user?.id, ipAddress: request.ip } });
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
