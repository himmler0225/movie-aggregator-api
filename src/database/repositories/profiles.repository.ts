import { Injectable } from '@nestjs/common';
import { Profile } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProfilesRepository extends BaseRepository<Profile> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.profile);
  }

  findByIds(ids: string[]) {
    return this.findMany({ where: { id: { in: ids } } });
  }
}
