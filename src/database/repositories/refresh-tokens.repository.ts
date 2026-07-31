import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RefreshTokensRepository extends BaseRepository<RefreshToken> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.refreshToken);
  }

  findValidByHash(tokenHash: string) {
    return this.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    });
  }

  revokeByHash(tokenHash: string) {
    return this.updateMany(
      { tokenHash, revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  revokeAllForUser(userId: string) {
    return this.updateMany(
      { userId, revokedAt: null },
      { revokedAt: new Date() },
    );
  }
}
