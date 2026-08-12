import { Injectable } from '@nestjs/common';
import { AiConversation } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AiConversationsRepository extends BaseRepository<AiConversation> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.aiConversation);
  }
  findByUserId(userId: string, page: number, pageSize: number) {
    return this.paginate({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      page,
      pageSize,
    });
  }
}
