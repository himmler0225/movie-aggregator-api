export interface AppConfig {
  port: number;
  /** Reverse-proxy hops in front of the API (Express "trust proxy"). */
  trustProxyHops: number;
  corsOrigins: string[];
  jwtSecret: string;
  frontendUrl: string;
  apiPublicUrl: string;
  defaultLocale: 'vi' | 'en';
  supabaseUrl: string;
  supabaseServiceKey: string;
  googleClientId: string;
  googleClientSecret: string;
  redisUrl: string;
}
