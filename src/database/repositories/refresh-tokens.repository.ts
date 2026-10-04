import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RefreshTokensRepository extends BaseRepository<RefreshToken> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.refreshToken);
  }

  /** An unexpired token that is live or was rotated less than `graceMs` ago. */
  findUsableByHash(tokenHash: string, graceMs: number) {
    return this.findOne({
      tokenHash,
      expiresAt: { gt: new Date() },
      OR: [
        { revokedAt: null },
        { revokedAt: { gt: new Date(Date.now() - graceMs) } },
      ],
    });
  }

  /** Soft revoke on rotation; keeps the first revokedAt so the grace window never extends. */
  rotateByHash(tokenHash: string) {
    return this.updateMany(
      { tokenHash, revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  /**
   * Hard revoke (logout): delete the token plus the user's rotated tokens, which would
   * otherwise stay usable for the rotation grace window.
   */
  deleteForLogout(userId: string, tokenHash: string) {
    return this.deleteMany({
      userId,
      OR: [{ tokenHash }, { revokedAt: { not: null } }],
    });
  }

  /** Hard revoke every session of a user (logout everywhere, password change). */
  deleteAllForUser(userId: string) {
    return this.deleteMany({ userId });
  }
}
