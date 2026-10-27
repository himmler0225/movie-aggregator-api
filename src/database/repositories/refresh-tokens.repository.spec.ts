import type { PrismaService } from '../prisma.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';

function repo() {
  const delegate = {
    findFirst: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = { refreshToken: delegate } as unknown as PrismaService;
  return { repository: new RefreshTokensRepository(prisma), delegate };
}

describe('RefreshTokensRepository', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T00:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('accepts live tokens and tokens rotated within the grace window', async () => {
    const { repository, delegate } = repo();
    await repository.findUsableByHash('hash', 120_000);
    expect(delegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tokenHash: 'hash',
          expiresAt: { gt: new Date('2026-10-04T00:00:00Z') },
          OR: [
            { revokedAt: null },
            { revokedAt: { gt: new Date('2026-10-03T23:58:00Z') } },
          ],
        },
      }),
    );
  });

  it('retires the parent and siblings once a replacement token is used', async () => {
    const { repository, delegate } = repo();
    await repository.retireAncestors({ id: 'child', parentId: 'parent' });
    expect(delegate.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ id: 'parent' }, { parentId: 'parent', id: { not: 'child' } }],
      },
    });
  });

  it('keeps root tokens (no parent) untouched', async () => {
    const { repository, delegate } = repo();
    await repository.retireAncestors({ id: 'root', parentId: null });
    expect(delegate.deleteMany).not.toHaveBeenCalled();
  });

  it('logout deletes the token, its rotation chain and legacy rotated tokens', async () => {
    const { repository, delegate } = repo();
    delegate.findFirst.mockResolvedValueOnce({ id: 't', parentId: 'p' });
    await repository.deleteForLogout('user-1', 'hash');
    expect(delegate.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        OR: [
          { tokenHash: 'hash' },
          { revokedAt: { not: null } },
          { id: 't' },
          { parentId: 't' },
          { id: 'p' },
          { parentId: 'p' },
        ],
      },
    });
  });
});
