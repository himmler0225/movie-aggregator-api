import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { appConfig, AppConfigModule } from './config';
import { PrismaModule } from './database/prisma.module';
import { SupabaseModule } from './database/supabase.module';
import { HealthController } from './health/health.controller';
import { I18nModule } from './i18n';
import { RedisModule } from './infra/redis';
import { MoviesModule } from './movies/movies.module';
import { AuthModule } from './platform/auth/auth.module';
import { JwtAuthGuard } from './platform/auth/jwt-auth.guard';
import { PlatformModule } from './platform/platform.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    AppConfigModule,
    I18nModule,
    RedisModule,
    PrismaModule,
    SupabaseModule,
    MoviesModule,
    AuthModule,
    PlatformModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
