import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { AuthUser } from '../types';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RATE_LIMIT } from '../../shared/constants';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import { AnalyticsService } from './analytics.service';

class TrackPageViewDto {
  @ApiProperty({ example: 'home' })
  @IsString()
  @MaxLength(64)
  page_type!: string;
}

class TrackSearchDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  keyword!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  results_count?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clicked_slug?: string;
}

class TrackWatchEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  movie_slug!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  movie_name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumb_url?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  episode_name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  server_name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  watch_duration_sec?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lang?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quality?: string;
}

@ApiTags('Analytics')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}
  @Public()
  @Post('page-view')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.analyticsPageView)
  trackPageView(
    @Body()
    body: TrackPageViewDto,
  ) {
    return this.analytics.trackPageView(body.page_type);
  }
  @Public()
  @Post('search')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.analyticsSearch)
  trackSearch(
    @Body()
    body: TrackSearchDto,
  ) {
    return this.analytics.trackSearch({
      keyword: body.keyword,
      resultsCount: body.results_count,
      clickedSlug: body.clicked_slug,
    });
  }
  @Post('watch-event')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  trackWatchEvent(
    @CurrentUser()
    user: AuthUser,
    @Body()
    body: TrackWatchEventDto,
  ) {
    return this.analytics.trackWatchEvent({
      userId: user.id,
      movieSlug: body.movie_slug,
      movieName: body.movie_name,
      thumbUrl: body.thumb_url,
      episodeName: body.episode_name,
      serverName: body.server_name,
      watchDurationSec: body.watch_duration_sec,
      completed: body.completed,
      lang: body.lang,
      quality: body.quality,
    });
  }
}
