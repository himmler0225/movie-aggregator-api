import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators';
import { RATE_LIMIT } from '../../shared/constants';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import { CreateReactionDto, HeatmapQueryDto } from './dto/moments.dto';
import { REACTION_EMOJIS } from './moments.constants';
import { MomentsService } from './moments.service';

@ApiTags('Moments')
@Controller('api/moments')
export class MomentsController {
  constructor(private readonly moments: MomentsService) {}
  @Public()
  @Get('emojis')
  emojis() {
    return REACTION_EMOJIS;
  }
  @Public()
  @Get('movie/:slug/heatmap')
  heatmap(
    @Param('slug')
    slug: string,
    @Query()
    query: HeatmapQueryDto,
  ) {
    return this.moments.heatmap(slug, query.episode);
  }
  @ApiBearerAuth()
  @Post('reactions')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.momentReaction)
  react(
    @Body()
    body: CreateReactionDto,
  ) {
    const ok = this.moments.record({
      movieSlug: body.movie_slug,
      episodeName: body.episode_name,
      time: body.time,
      emoji: body.emoji,
    });
    return { ok };
  }
}
