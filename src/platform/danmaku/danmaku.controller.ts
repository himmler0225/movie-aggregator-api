import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { RATE_LIMIT } from '../../shared/constants';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import { DanmakuService } from './danmaku.service';
import { CreateDanmakuDto, ListDanmakuQueryDto } from './dto/danmaku.dto';

@ApiTags('Danmaku')
@Controller('api/danmaku')
export class DanmakuController {
  constructor(private readonly danmaku: DanmakuService) {}
  @Public()
  @Get('movie/:slug')
  list(
    @Param('slug')
    slug: string,
    @Query()
    query: ListDanmakuQueryDto,
  ) {
    return this.danmaku.list({
      movieSlug: slug,
      episodeName: query.episode,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
  }
  @ApiBearerAuth()
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.danmaku)
  create(
    @CurrentUser()
    user: AuthUser,
    @Body()
    body: CreateDanmakuDto,
  ) {
    return this.danmaku.create({
      userId: user.id,
      movieSlug: body.movie_slug,
      episodeName: body.episode_name,
      playbackTime: body.playback_time,
      content: body.content,
    });
  }
  @ApiBearerAuth()
  @Delete(':id')
  remove(
    @CurrentUser()
    user: AuthUser,
    @Param('id', ParseUUIDPipe)
    id: string,
  ) {
    return this.danmaku.remove(id, user.id);
  }
}
