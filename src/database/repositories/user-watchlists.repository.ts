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
    return this.prisma.$transaction(
      lists.map((list) =>
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
    );
  }
}
