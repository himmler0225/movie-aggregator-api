import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppConfigService } from '../../config';
import {
  FRONTEND_AUTH_CALLBACK_PATH,
  RATE_LIMIT,
} from '../../shared/constants';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.decorators';
import { CurrentUser, Public } from './auth.decorators';
import {
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  UpdatePasswordDto,
} from './dto/auth.dto';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie.util';

type SessionWithRefresh = { refresh_token?: string };

/** Approval-gate failures surfaced to the frontend as `/auth/callback?error=…`. */
const GOOGLE_ACCOUNT_STATUS_ERRORS: Record<string, string> = {
  'auth.accountPending': 'account_pending',
  'auth.accountRejected': 'account_rejected',
};

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private readonly auth: AuthService,
    private readonly appConfig: AppConfigService,
  ) {}

  // A method, not a getter: logRegisteredRoutes walks the prototype and would invoke it.
  private secureCookies() {
    return this.appConfig.apiPublicUrl.startsWith('https://');
  }

  /** Moves the refresh token from the JSON body into the httpOnly cookie. */
  private withRefreshCookie<T extends SessionWithRefresh | null>(
    res: Response,
    session: T,
  ): T {
    if (session?.refresh_token) {
      setRefreshCookie(res, session.refresh_token, this.secureCookies());
      delete session.refresh_token;
    }
    return session;
  }

  @Public()
  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.authRegister)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.username);
  }

  @Public()
  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.authLogin)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withRefreshCookie(
      res,
      await this.auth.login(dto.email, dto.password),
    );
  }

  @Public()
  @Post('refresh')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.authRefresh)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access JWT' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Body token: one-time upgrade for browsers that still hold it in localStorage.
    const token = readRefreshCookie(req) ?? dto?.refresh_token;
    try {
      return this.withRefreshCookie(res, await this.auth.refresh(token ?? ''));
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === Number(HttpStatus.UNAUTHORIZED)
      ) {
        clearRefreshCookie(res, this.secureCookies());
      }
      throw error;
    }
  }

  @ApiBearerAuth()
  @Get('session')
  async session(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('issue_refresh') issueRefresh?: string,
  ) {
    return this.withRefreshCookie(
      res,
      await this.auth.getSession(user.id, {
        issueRefresh: issueRefresh === '1',
      }),
    );
  }

  @ApiBearerAuth()
  @Post('logout')
  @Public()
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Public: logging out must work with an expired access token too; the refresh
    // token itself identifies the session to revoke.
    const token = readRefreshCookie(req) ?? dto?.refresh_token;
    clearRefreshCookie(res, this.secureCookies());
    if (token) await this.auth.logoutByToken(token);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post('update-password')
  updatePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.auth.updatePassword(user.id, dto.password);
  }

  @Public()
  @Post('reset-password')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.authResetPassword)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.requestPasswordReset(dto.email).then(() => ({ ok: true }));
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Redirect to Google OAuth consent screen' })
  googleStart(
    @Query('redirect_uri') redirectUri: string | undefined,
    @Res() res: Response,
  ) {
    const feRedirect = this.auth.isAllowedFrontendRedirect(redirectUri)
      ? redirectUri.trim()
      : `${this.appConfig.frontendUrl}${FRONTEND_AUTH_CALLBACK_PATH}`;
    try {
      const { url } = this.auth.getGoogleAuthUrl(feRedirect);
      return res.redirect(url);
    } catch {
      return res.redirect(`${feRedirect}?error=oauth_not_configured`);
    }
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback — redirects to frontend with token hash',
  })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error || !code || !state) {
      return res.redirect(
        `${this.appConfig.frontendUrl}${FRONTEND_AUTH_CALLBACK_PATH}?error=oauth_denied`,
      );
    }
    try {
      const { session, frontendRedirect } =
        await this.auth.handleGoogleCallback(code, state);
      this.withRefreshCookie(res, session);
      const hash = new URLSearchParams({
        access_token: session.access_token,
        expires_at: String(session.expires_at),
      });
      return res.redirect(`${frontendRedirect}#${hash.toString()}`);
    } catch (err) {
      const statusError =
        err instanceof Error
          ? GOOGLE_ACCOUNT_STATUS_ERRORS[err.message]
          : undefined;
      if (statusError) {
        return res.redirect(
          `${this.appConfig.frontendUrl}${FRONTEND_AUTH_CALLBACK_PATH}?error=${statusError}`,
        );
      }
      this.logger.error(
        `Google OAuth callback failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return res.redirect(
        `${this.appConfig.frontendUrl}${FRONTEND_AUTH_CALLBACK_PATH}?error=oauth_failed`,
      );
    }
  }
}
