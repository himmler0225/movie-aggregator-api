import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/auth.decorators';
import { PermissionsGuard } from '../../auth/permissions.guard';
import type { ListUsersOptions } from '../../types';
import { UpdateUserRoleDto, UpdateUserStatusDto } from '../dto/admin.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin/users')
@UseGuards(PermissionsGuard)
@RequirePermission('users:read')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}
  @Get()
  listUsers(
    @Query('query')
    query = '',
    @Query('sort')
    sort: 'new' | 'name' = 'new',
    @Query('filter')
    filter: ListUsersOptions['filter'] = 'all',
    @Query('page')
    page = '0',
    @Query('pageSize')
    pageSize = '20',
  ) {
    return this.adminUsers.listUsers({
      query,
      sort,
      filter,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }
  @Patch(':userId/role')
  @RequirePermission('users:write')
  updateRole(
    @Param('userId')
    userId: string,
    @Body()
    body: UpdateUserRoleDto,
  ) {
    return this.adminUsers.updateUserRole(userId, body.role);
  }
  @Get('pending')
  pendingUsers() {
    return this.adminUsers.pendingUsers();
  }
  @Patch(':userId/status')
  @RequirePermission('users:write')
  updateStatus(
    @Param('userId')
    userId: string,
    @Body()
    body: UpdateUserStatusDto,
  ) {
    return this.adminUsers.updateUserStatus(userId, body.status);
  }
  @Get('recent')
  recentUsers() {
    return this.adminUsers.recentUsers();
  }
  @Get(':userId/watch-history')
  userWatchHistory(
    @Param('userId')
    userId: string,
    @Query('limit')
    limit?: string,
  ) {
    return this.adminUsers.userWatchHistory(
      userId,
      limit ? Number(limit) : undefined,
    );
  }
  @Get(':userId/favorites')
  userFavorites(
    @Param('userId')
    userId: string,
  ) {
    return this.adminUsers.userFavorites(userId);
  }
}
