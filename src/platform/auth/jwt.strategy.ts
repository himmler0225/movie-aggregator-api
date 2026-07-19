import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../config';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import type { AuthUser, JwtPayload } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly profiles: ProfilesRepository,
    appConfig: AppConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const profile = await this.profiles.findById(payload.sub);
    return {
      id: payload.sub,
      email: payload.email,
      role: profile?.role ?? 'user',
    };
  }
}
