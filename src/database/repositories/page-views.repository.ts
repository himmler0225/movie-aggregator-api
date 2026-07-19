import { Injectable } from '@nestjs/common';
import { PageView } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PageViewsRepository extends BaseRepository<PageView> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.pageView);
  }
}
