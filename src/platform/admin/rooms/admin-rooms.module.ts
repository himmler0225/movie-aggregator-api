import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../../database/repositories/repositories.module';
import { AuthModule } from '../../auth/auth.module';
import { AdminRoomsController } from './admin-rooms.controller';
import { AdminRoomsService } from './admin-rooms.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [AdminRoomsController],
  providers: [AdminRoomsService],
})
export class AdminRoomsModule {}
