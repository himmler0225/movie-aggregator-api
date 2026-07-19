import { Injectable } from '@nestjs/common';
import { Favorite } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FavoritesRepository extends BaseRepository<Favorite> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.favorite);
  }

  findByUserId(userId: string) {
    return this.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  findSlugMap(userId: string) {
    return this.findMany({
      where: { userId },
      select: { id: true, movieSlug: true },
    });
  }

  deleteBySlug(userId: string, movieSlug: string) {
    return this.deleteMany({ userId, movieSlug });
  }
}
