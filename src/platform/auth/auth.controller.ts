import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
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

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private readonly auth: AuthService,
    private readonly appConfig: AppConfigService,
  ) {}

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
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.authRefresh)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access JWT' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @ApiBearerAuth()
  @Get('session')
  async session(
    @CurrentUser() user: AuthUser,
    @Query('issue_refresh') issueRefresh?: string,
  ) {
    return this.auth.getSession(user.id, {
      issueRefresh: issueRefresh === '1',
    });
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    return this.auth.logout(user.id, dto?.refresh_token);
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
    const feRedirect =
      redirectUri?.trim() ||
      `${this.appConfig.frontendUrl}${FRONTEND_AUTH_CALLBACK_PATH}`;
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
      const hash = new URLSearchParams({
        access_token: session.access_token,
        expires_at: String(session.expires_at),
      });
      if (session.refresh_token) {
        hash.set('refresh_token', session.refresh_token);
      }
      return res.redirect(`${frontendRedirect}#${hash.toString()}`);
    } catch (err) {
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
