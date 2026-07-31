import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../types';
import { PERMISSION_KEY } from './auth.decorators';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const scope = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!scope) {
      throw new ForbiddenException('auth.adminRequired');
    }
    const { user } = context.switchToHttp().getRequest<{
      user: AuthUser;
    }>();
    if (!user || !this.permissions.has(user.role, scope)) {
      throw new ForbiddenException('auth.adminRequired');
    }
    return true;
  }
}
