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

  /**
   * `token` was just used, which proves the client received it: its parent and any
   * siblings (replacements whose response never arrived, or a concurrent refresh) are
   * now obsolete.
   */
  retireAncestors(token: Pick<RefreshToken, 'id' | 'parentId'>) {
    if (!token.parentId) return Promise.resolve({ count: 0 });
    return this.deleteMany({
      OR: [
        { id: token.parentId },
        { parentId: token.parentId, id: { not: token.id } },
      ],
    });
  }

  /**
   * Hard revoke (logout) of one device: the token, its whole rotation chain (parent
   * and replacements that are still usable) and the user's legacy soft-revoked rows,
   * which would otherwise stay usable for the rotation grace window.
   */
  async deleteForLogout(userId: string, tokenHash: string) {
    const token = await this.findOne({ userId, tokenHash });
    const chain = token
      ? [
          { id: token.id },
          { parentId: token.id },
          ...(token.parentId
            ? [{ id: token.parentId }, { parentId: token.parentId }]
            : []),
        ]
      : [];
    return this.deleteMany({
      userId,
      OR: [{ tokenHash }, { revokedAt: { not: null } }, ...chain],
    });
  }

  /** Hard revoke every session of a user (logout everywhere, password change). */
  deleteAllForUser(userId: string) {
    return this.deleteMany({ userId });
  }
}
