import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { RATE_LIMIT } from '../../shared/constants';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import {
  CreateSkipMarkDto,
  DeleteSkipMarkQueryDto,
  SkipMarksQueryDto,
} from './dto/skip-markers.dto';
import { SkipMarkersService } from './skip-markers.service';

@ApiTags('Skip markers')
@ApiBearerAuth()
@Controller('api/skip-markers')
export class SkipMarkersController {
  constructor(private readonly skip: SkipMarkersService) {}
  @Get('movie/:slug')
  @ApiOperation({ summary: 'Agreed intro/outro segments + my own marks' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Query() query: SkipMarksQueryDto,
  ) {
    return this.skip.forEpisode(user.id, slug, query.episode);
  }
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.skipMark)
  mark(@CurrentUser() user: AuthUser, @Body() body: CreateSkipMarkDto) {
    return this.skip.mark(user.id, {
      movieSlug: body.movie_slug,
      episodeName: body.episode_name,
      kind: body.kind,
      startSec: body.start_sec,
      endSec: body.end_sec,
    });
  }
  @Delete('movie/:slug')
  unmark(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Query() query: DeleteSkipMarkQueryDto,
  ) {
    return this.skip.unmark(user.id, slug, query.episode, query.kind);
  }
}
