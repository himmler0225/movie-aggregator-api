import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../../database/repositories/repositories.module';
import { AuthModule } from '../../auth/auth.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [AdminAnalyticsController],
  providers: [AdminAnalyticsService],
})
export class AdminAnalyticsModule {}
