import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestLike } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const user = await this.auth.authenticate(request);
    if (!user) throw new UnauthorizedException('Authentication required');
    request.user = user;
    return true;
  }
}
