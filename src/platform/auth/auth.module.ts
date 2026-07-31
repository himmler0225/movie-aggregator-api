import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfigService } from '../../config';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { ACCESS_TOKEN_TTL_SECONDS } from '../../shared/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [
    RepositoriesModule,
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => ({
        secret: appConfig.jwtSecret,
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthService,
    JwtStrategy,
    PermissionsService,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    GoogleOAuthService,
    JwtModule,
    PassportModule,
    JwtStrategy,
    PermissionsService,
    PermissionsGuard,
  ],
})
export class AuthModule {}
