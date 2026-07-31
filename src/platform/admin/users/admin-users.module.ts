import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../../database/repositories/repositories.module';
import { AuthModule } from '../../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
