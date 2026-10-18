import type { UserPreferencesRepository } from '../../database/repositories/user-preferences.repository';
import { AppError } from '../../shared/errors';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  const merge = jest.fn().mockResolvedValue(undefined);
  const service = new PreferencesService({
    merge,
    get: jest.fn(),
  } as unknown as UserPreferencesRepository);

  beforeEach(() => merge.mockClear());

  it('merges whitelisted keys', async () => {
    await service.update('u1', {
      player: { volume: 0.5 },
      recentSearches: ['a'],
    });
    expect(merge).toHaveBeenCalledWith('u1', {
      player: { volume: 0.5 },
      recentSearches: ['a'],
    });
  });

  it('rejects unknown keys and oversized values', async () => {
    await expect(service.update('u1', { token: 'x' })).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(
      service.update('u1', { moviePrefs: { big: 'x'.repeat(40_000) } }),
    ).rejects.toBeInstanceOf(AppError);
    expect(merge).not.toHaveBeenCalled();
  });

  it('skips the write when nothing is left to store', async () => {
    await service.update('u1', {});
    expect(merge).not.toHaveBeenCalled();
  });
});
