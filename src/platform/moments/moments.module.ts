import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { MomentsController } from './moments.controller';
import { MomentsService } from './moments.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [MomentsController],
  providers: [MomentsService],
  exports: [MomentsService],
})
export class MomentsModule {}
