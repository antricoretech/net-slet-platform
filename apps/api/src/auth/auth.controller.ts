import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CookieResponse, RequestLike } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown, @Req() request: RequestLike, @Res({ passthrough: true }) response: CookieResponse) {
    const result = await this.auth.register(body, request);
    if (result.token) response.setHeader('Set-Cookie', this.auth.sessionCookie(result.token));
    return { account: result.user, requiresEmailVerification: result.requiresEmailVerification ?? false };
  }

  @Post('verify-email')
  verifyEmail(@Body() body: unknown, @Req() request: RequestLike) { return this.auth.verifyEmail(body, request); }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() body: unknown, @Req() request: RequestLike) {
    await this.auth.requestPasswordReset(body, request);
    return { ok: true };
  }

  @Post('password-reset/complete')
  async completePasswordReset(@Body() body: unknown, @Req() request: RequestLike) {
    await this.auth.completePasswordReset(body, request);
    return { ok: true };
  }

  @Post('login')
  async login(@Body() body: unknown, @Req() request: RequestLike, @Res({ passthrough: true }) response: CookieResponse) {
    const result = await this.auth.login(body, request);
    response.setHeader('Set-Cookie', this.auth.sessionCookie(result.token!));
    return { account: result.user };
  }

  @Post('logout')
  async logout(@Req() request: RequestLike, @Res({ passthrough: true }) response: CookieResponse) {
    await this.auth.logout(request);
    response.setHeader('Set-Cookie', this.auth.clearSessionCookie());
    return { ok: true };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() request: RequestLike) { return { account: request.user }; }
}
