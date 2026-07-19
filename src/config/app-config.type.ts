export interface AppConfig {
  port: number;
  corsOrigins: string[];
  jwtSecret: string;
  frontendUrl: string;
  apiPublicUrl: string;
  defaultLocale: 'vi' | 'en';
  supabaseUrl: string;
  supabaseServiceKey: string;
  googleClientId: string;
  googleClientSecret: string;
}
