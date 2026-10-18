import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}
  async get(userId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.userPreference.findUnique({
      where: { userId },
      select: { data: true },
    });
    const data = row?.data;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }
  /**
   * Shallow-merges `patch` into the stored document in one statement, so two
   * tabs saving different keys at once cannot overwrite each other.
   */
  async merge(userId: string, patch: Record<string, unknown>) {
    const json = JSON.stringify(patch);
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO public.user_preferences (user_id, data, updated_at)
      VALUES (${userId}::uuid, ${json}::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE
        SET data = public.user_preferences.data || EXCLUDED.data,
            updated_at = now()
    `);
  }
}
