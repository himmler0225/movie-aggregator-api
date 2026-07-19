import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { DeleteCommentsDto, UpdateUserRoleDto } from './dto/admin.dto';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard/stats')
  stats(@Query('from') from: string, @Query('prevFrom') prevFrom: string) {
    return this.admin.dashboardStats(from, prevFrom);
  }

  @Get('dashboard/line')
  line(@Query('from') from: string, @Query('days') days?: string) {
    return this.admin.dashboardLineData(from, days ? Number(days) : 7);
  }

  @Get('dashboard/page-types')
  pageTypes(@Query('from') from: string) {
    return this.admin.pageTypeDistribution(from);
  }

  @Get('dashboard/top-movies')
  topMovies(@Query('from') from: string) {
    return this.admin.topMovies(from);
  }

  @Get('dashboard/top-keywords')
  topKeywords(@Query('from') from: string) {
    return this.admin.topKeywords(from);
  }

  @Get('users')
  users(
    @Query('query') query = '',
    @Query('sort') sort: 'new' | 'name' = 'new',
    @Query('filter') filter: 'all' | 'free' | 'premium' | 'admin' = 'all',
    @Query('page') page = '0',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.admin.listUsers({
      query,
      sort,
      filter,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Patch('users/:userId/role')
  updateRole(@Param('userId') userId: string, @Body() body: UpdateUserRoleDto) {
    return this.admin.updateUserRole(userId, body.role);
  }

  @Get('users/recent')
  recentUsers() {
    return this.admin.recentUsers();
  }

  @Get('comments/stats')
  commentStats() {
    return this.admin.commentStats();
  }

  @Get('comments')
  comments(
    @Query('query') query = '',
    @Query('movie') movie = '',
    @Query('sort') sort: 'new' | 'likes' = 'new',
    @Query('page') page = '0',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.admin.listComments({
      query,
      movie,
      sort,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Delete('comments')
  deleteComments(@Body() body: DeleteCommentsDto) {
    return this.admin.deleteComments(body.ids);
  }

  @Get('comments/recent')
  recentComments() {
    return this.admin.recentComments();
  }

  @Get('rooms/stats')
  roomStats() {
    return this.admin.roomStats();
  }

  @Get('rooms')
  rooms(@Query('history') history?: string) {
    return this.admin.listRooms(history === '1');
  }

  @Delete('rooms/:roomId')
  deleteRoom(@Param('roomId') roomId: string) {
    return this.admin.deleteRoom(roomId);
  }
}
