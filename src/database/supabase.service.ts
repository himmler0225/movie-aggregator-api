import { Injectable, Logger } from '@nestjs/common';
import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { AppConfigService } from '../config';
import { PrismaService } from './prisma.service';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly client: SupabaseClient | null;
  constructor(
    private readonly prisma: PrismaService,
    appConfig: AppConfigService,
  ) {
    const url = appConfig.supabaseUrl;
    const key = appConfig.supabaseServiceKey;
    if (!appConfig.isSupabaseConfigured) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_KEY missing — auth will fail',
      );
      this.client = null;
      return;
    }
    this.client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase is not configured');
    }
    return this.client;
  }
  signInWithPassword(email: string, password: string) {
    return this.requireClient().auth.signInWithPassword({ email, password });
  }
  createUser(params: {
    email: string;
    password?: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
  }) {
    return this.requireClient().auth.admin.createUser(params);
  }
  getUserById(userId: string) {
    return this.requireClient().auth.admin.getUserById(userId);
  }
  updateUserById(
    userId: string,
    attrs: {
      password?: string;
      user_metadata?: Record<string, unknown>;
    },
  ) {
    return this.requireClient().auth.admin.updateUserById(userId, attrs);
  }
  listUsers(page: number, perPage: number) {
    return this.requireClient().auth.admin.listUsers({ page, perPage });
  }
  resetPasswordForEmail(email: string, redirectTo: string) {
    return this.requireClient().auth.resetPasswordForEmail(email, {
      redirectTo,
    });
  }
  async findUserByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
        }>
      >`
        SELECT id::text AS id
        FROM auth.users
        WHERE lower(email) = ${normalized}
        LIMIT 1
      `;
      const id = rows[0]?.id;
      if (id) {
        const { data, error } = await this.getUserById(id);
        if (!error && data.user) return data.user;
      }
    } catch (err) {
      this.logger.warn(
        `auth.users lookup failed, falling back to admin API: ${String(err)}`,
      );
    }
    let page = 1;
    while (true) {
      const { data, error } = await this.listUsers(page, 200);
      if (error) throw error;
      const match = data.users.find(
        (u) => u.email?.toLowerCase() === normalized,
      );
      if (match) return match;
      if (data.users.length < 200) break;
      page += 1;
    }
    return null;
  }
}
