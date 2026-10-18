import { Injectable } from '@nestjs/common';
import { UserPreferencesRepository } from '../../database/repositories/user-preferences.repository';
import { AppError, AppErrorCode } from '../../shared/errors';

/** Top-level keys a client may store; anything else is rejected. */
export const PREFERENCE_KEYS = [
  'player',
  'moviePrefs',
  'settings',
  'recentSearches',
  'episodeSnapshots',
  'notifReadAt',
] as const;

const MAX_VALUE_BYTES = 32 * 1024;

@Injectable()
export class PreferencesService {
  constructor(private readonly prefs: UserPreferencesRepository) {}
  get(userId: string) {
    return this.prefs.get(userId);
  }
  async update(userId: string, patch: Record<string, unknown>) {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!(PREFERENCE_KEYS as readonly string[]).includes(key)) {
        throw new AppError(
          AppErrorCode.BAD_REQUEST,
          `Unknown preference: ${key}`,
        );
      }
      if (value === undefined) continue;
      if (Buffer.byteLength(JSON.stringify(value)) > MAX_VALUE_BYTES) {
        throw new AppError(
          AppErrorCode.BAD_REQUEST,
          `Preference too large: ${key}`,
        );
      }
      clean[key] = value;
    }
    if (Object.keys(clean).length > 0) await this.prefs.merge(userId, clean);
    return { ok: true };
  }
}
