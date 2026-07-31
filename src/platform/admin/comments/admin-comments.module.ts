import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../../database/repositories/repositories.module';
import { AuthModule } from '../../auth/auth.module';
import { CommentsModule } from '../../comments/comments.module';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminCommentsService } from './admin-comments.service';

@Module({
  imports: [RepositoriesModule, AuthModule, CommentsModule],
  controllers: [AdminCommentsController],
  providers: [AdminCommentsService],
})
export class AdminCommentsModule {}
