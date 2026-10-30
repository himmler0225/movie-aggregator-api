import { Injectable } from '@nestjs/common';
import { UserWatchlist } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserWatchlistsRepository extends BaseRepository<UserWatchlist> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.userWatchlist);
  }
  findByUserId(userId: string) {
    return this.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }
  upsertMany(
    userId: string,
    lists: {
      id: string;
      name: string;
      slugs: string[];
      createdAt: Date;
    }[],
  ) {
    // Replace semantics: lists missing from the payload were deleted client-side.
    return this.prisma.$transaction([
      this.prisma.userWatchlist.deleteMany({
        where: { userId, listKey: { notIn: lists.map((l) => l.id) } },
      }),
      ...lists.map((list) =>
        this.prisma.userWatchlist.upsert({
          where: { userId_listKey: { userId, listKey: list.id } },
          create: {
            userId,
            listKey: list.id,
            name: list.name,
            slugs: list.slugs,
            createdAt: list.createdAt,
          },
          update: {
            name: list.name,
            slugs: list.slugs,
          },
        }),
      ),
    ]);
  }
  findByShareId(shareId: string) {
    return this.findOne({ shareId, isPublic: true });
  }
  setSharing(
    userId: string,
    listKey: string,
    isPublic: boolean,
    shareId?: string,
  ) {
    return this.prisma.userWatchlist.update({
      where: { userId_listKey: { userId, listKey } },
      data: { isPublic, ...(shareId ? { shareId } : {}) },
    });
  }
}
