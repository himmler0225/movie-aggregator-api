import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../../database/repositories/repositories.module';
import { AuthModule } from '../../auth/auth.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
