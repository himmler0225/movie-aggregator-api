import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { AiChatService } from './ai-chat.service';
import { AppendAiChatMessageDto } from './dto/ai-chat.dto';

@ApiTags('AI Chat')
@ApiBearerAuth()
@Controller('api/ai-chat')
export class AiChatController {
  constructor(private readonly aiChat: AiChatService) {}
  @Get('conversations')
  listConversations(
    @CurrentUser()
    user: AuthUser,
    @Query()
    query: PaginationDto,
  ) {
    return this.aiChat.listConversations(user.id, query.page!, query.limit!);
  }
  @Post('conversations')
  createConversation(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.aiChat.createConversation(user.id);
  }
  @Get('conversations/:id/messages')
  listMessages(
    @CurrentUser()
    user: AuthUser,
    @Param('id')
    id: string,
  ) {
    return this.aiChat.listMessages(id, user.id);
  }
  @Post('conversations/:id/messages')
  appendMessage(
    @CurrentUser()
    user: AuthUser,
    @Param('id')
    id: string,
    @Body()
    body: AppendAiChatMessageDto,
  ) {
    return this.aiChat.appendMessage(id, user.id, body);
  }
  @Delete('conversations/:id')
  deleteConversation(
    @CurrentUser()
    user: AuthUser,
    @Param('id')
    id: string,
  ) {
    return this.aiChat.deleteConversation(id, user.id);
  }
}
