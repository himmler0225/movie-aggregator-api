import { Injectable } from '@nestjs/common';
import { SearchLog } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SearchLogsRepository extends BaseRepository<SearchLog> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.searchLog);
  }
}
