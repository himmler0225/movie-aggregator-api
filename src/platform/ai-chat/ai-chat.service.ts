import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiChatMessagesRepository } from '../../database/repositories/ai-chat-messages.repository';
import { AiConversationsRepository } from '../../database/repositories/ai-conversations.repository';
import { mapAiChatMessage, mapAiConversation } from '../mappers';
import type { AppendAiChatMessageInput } from '../types';

const TITLE_MAX_LENGTH = 60;

@Injectable()
export class AiChatService {
  constructor(
    private readonly conversations: AiConversationsRepository,
    private readonly messages: AiChatMessagesRepository,
  ) {}
  async listConversations(userId: string, page: number, pageSize: number) {
    const result = await this.conversations.findByUserId(
      userId,
      page,
      pageSize,
    );
    return { ...result, data: result.data.map(mapAiConversation) };
  }
  async createConversation(userId: string) {
    const row = await this.conversations.create({ userId });
    return mapAiConversation(row);
  }
  private async assertOwnedConversation(
    conversationId: string,
    userId: string,
  ) {
    const row = await this.conversations.findById(conversationId);
    if (!row) throw new NotFoundException('platform.conversationNotFound');
    if (row.userId !== userId) {
      throw new ForbiddenException('platform.conversationNotFound');
    }
    return row;
  }
  async listMessages(conversationId: string, userId: string) {
    await this.assertOwnedConversation(conversationId, userId);
    const rows = await this.messages.findByConversationId(conversationId);
    return rows.map(mapAiChatMessage);
  }
  async appendMessage(
    conversationId: string,
    userId: string,
    input: AppendAiChatMessageInput,
  ) {
    const conversation = await this.assertOwnedConversation(
      conversationId,
      userId,
    );
    const row = await this.messages.create({
      conversationId,
      role: input.role,
      content: input.content,
      actions: input.actions ?? undefined,
      videos: input.videos ?? undefined,
    });
    if (!conversation.title && input.role === 'user') {
      const title = input.content.slice(0, TITLE_MAX_LENGTH);
      await this.conversations.update({ id: conversationId }, { title });
    } else {
      await this.conversations.update({ id: conversationId }, {});
    }
    return mapAiChatMessage(row);
  }
  async deleteConversation(conversationId: string, userId: string) {
    await this.assertOwnedConversation(conversationId, userId);
    await this.conversations.delete({ id: conversationId });
  }
}
