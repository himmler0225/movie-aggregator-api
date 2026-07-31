import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/auth.decorators';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(PermissionsGuard)
@RequirePermission('analytics:read')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}
  @Get('analytics/search')
  searchAnalytics(
    @Query('from')
    from: string,
  ) {
    return this.analytics.searchAnalytics(from);
  }
  @Get('analytics/hourly')
  hourlyWatchViews(
    @Query('from')
    from: string,
  ) {
    return this.analytics.hourlyWatchViews(from);
  }
  @Get('analytics/rooms')
  roomAnalytics(
    @Query('from')
    from: string,
  ) {
    return this.analytics.roomAnalytics(from);
  }
  @Get('analytics/lang-quality')
  langQuality(
    @Query('from')
    from: string,
  ) {
    return this.analytics.langQualityDistribution(from);
  }
  @Get('movies/:slug/events')
  movieEvents(
    @Param('slug')
    slug: string,
    @Query('from')
    from: string,
  ) {
    return this.analytics.movieWatchEvents(slug, from);
  }
}
