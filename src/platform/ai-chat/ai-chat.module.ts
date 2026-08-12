import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
