import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, RateLimitGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
