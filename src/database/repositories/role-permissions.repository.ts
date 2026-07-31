import { Injectable } from '@nestjs/common';
import { RolePermission } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RolePermissionsRepository extends BaseRepository<RolePermission> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.rolePermission);
  }
}
