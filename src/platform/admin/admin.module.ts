import { Module } from '@nestjs/common';
import { AdminAnalyticsModule } from './analytics/admin-analytics.module';
import { AdminCommentsModule } from './comments/admin-comments.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminRoomsModule } from './rooms/admin-rooms.module';
import { AdminUsersModule } from './users/admin-users.module';

@Module({
  imports: [
    AdminDashboardModule,
    AdminUsersModule,
    AdminCommentsModule,
    AdminRoomsModule,
    AdminAnalyticsModule,
  ],
})
export class AdminModule {}
