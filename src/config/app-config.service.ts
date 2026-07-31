import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './app-config.type';
import {
  APP_CONFIG_KEY,
  loadAppConfig,
  resolveCorsOriginOption,
} from './app.config';

@Injectable()
export class AppConfigService {
  private readonly values: AppConfig;
  constructor(config: ConfigService) {
    this.values = config.get<AppConfig>(APP_CONFIG_KEY) ?? loadAppConfig();
  }
  get(): AppConfig {
    return this.values;
  }
  get port() {
    return this.values.port;
  }
  get corsOrigins() {
    return this.values.corsOrigins;
  }
  get jwtSecret() {
    return this.values.jwtSecret;
  }
  get frontendUrl() {
    return this.values.frontendUrl;
  }
  get apiPublicUrl() {
    return this.values.apiPublicUrl;
  }
  get defaultLocale() {
    return this.values.defaultLocale;
  }
  get supabaseUrl() {
    return this.values.supabaseUrl;
  }
  get supabaseServiceKey() {
    return this.values.supabaseServiceKey;
  }
  get googleClientId() {
    return this.values.googleClientId;
  }
  get googleClientSecret() {
    return this.values.googleClientSecret;
  }
  get isGoogleOAuthConfigured() {
    return Boolean(this.googleClientId && this.googleClientSecret);
  }
  get isSupabaseConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseServiceKey);
  }
  get redisUrl() {
    return this.values.redisUrl;
  }
  get isRedisConfigured() {
    return Boolean(this.redisUrl);
  }
  get corsOriginOption(): string[] | true {
    return resolveCorsOriginOption(this.corsOrigins);
  }
}
