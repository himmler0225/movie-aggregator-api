import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';

describe('FavoritesService.remove ownership', () => {
  const repo = {
    findById: jest.fn(),
    deleteMany: jest.fn(),
  };
  const service = new FavoritesService(repo as never);
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('deletes when favorite belongs to user', async () => {
    repo.findById.mockResolvedValue({ id: 'f1', userId: 'u1' });
    repo.deleteMany.mockResolvedValue(1);
    await expect(service.remove('u1', 'f1')).resolves.toEqual({ ok: true });
    expect(repo.deleteMany).toHaveBeenCalledWith({ id: 'f1', userId: 'u1' });
  });
  it('404 when deleting another users favorite', async () => {
    repo.findById.mockResolvedValue({ id: 'f1', userId: 'other' });
    await expect(service.remove('u1', 'f1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.deleteMany).not.toHaveBeenCalled();
  });
  it('404 when missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.remove('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
