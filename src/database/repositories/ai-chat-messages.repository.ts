import { Injectable } from '@nestjs/common';
import { AiChatMessage } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';
import { QUERY_LIMITS } from '../../shared/constants';

@Injectable()
export class AiChatMessagesRepository extends BaseRepository<AiChatMessage> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.aiChatMessage);
  }
  findByConversationId(
    conversationId: string,
    limit: number = QUERY_LIMITS.aiChatMessages,
  ) {
    return this.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
  countByConversationId(conversationId: string) {
    return this.count({ conversationId });
  }
}
