import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { RATE_LIMIT } from '../../shared/constants';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import { SubscribePushDto, UnsubscribePushDto } from './dto/push.dto';
import { PushService } from './push.service';

@ApiTags('Push')
@Controller('api/push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Public()
  @Get('public-key')
  @ApiOperation({ summary: 'VAPID public key (null when push is disabled)' })
  publicKey() {
    return { public_key: this.push.publicKey };
  }

  @ApiBearerAuth()
  @Post('subscribe')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.pushSubscribe)
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body() body: SubscribePushDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.push.subscribe(user.id, {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: userAgent?.slice(0, 300),
    });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Delete('subscribe')
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body() body: UnsubscribePushDto,
  ) {
    await this.push.unsubscribe(user.id, body.endpoint);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post('test')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.pushSubscribe)
  @ApiOperation({ summary: 'Send a test notification to my devices' })
  async test(@CurrentUser() user: AuthUser) {
    const delivered = await this.push.sendToUsers([user.id], {
      title: 'Cine-Flow',
      body: 'Thông báo đã hoạt động 🎉',
      url: '/',
      tag: 'test',
    });
    return { delivered };
  }
}
