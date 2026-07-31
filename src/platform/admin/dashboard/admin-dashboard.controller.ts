import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/auth.decorators';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin/dashboard')
@UseGuards(PermissionsGuard)
@RequirePermission('dashboard:read')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}
  @Get('stats')
  stats(
    @Query('from')
    from: string,
    @Query('prevFrom')
    prevFrom: string,
  ) {
    return this.dashboard.dashboardStats(from, prevFrom);
  }
  @Get('line')
  line(
    @Query('from')
    from: string,
    @Query('days')
    days?: string,
  ) {
    return this.dashboard.dashboardLineData(from, days ? Number(days) : 7);
  }
  @Get('page-types')
  pageTypes(
    @Query('from')
    from: string,
  ) {
    return this.dashboard.pageTypeDistribution(from);
  }
  @Get('top-movies')
  topMovies(
    @Query('from')
    from: string,
  ) {
    return this.dashboard.topMovies(from);
  }
  @Get('top-keywords')
  topKeywords(
    @Query('from')
    from: string,
  ) {
    return this.dashboard.topKeywords(from);
  }
}
