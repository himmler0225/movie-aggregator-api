import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WatchHistoryBatchDto, WatchHistoryUpsertDto } from './dto/watch-history.dto';
import { WatchHistoryService } from './watch-history.service';

@ApiTags('Watch History')
@ApiBearerAuth()
@Controller('api/watch-history')
@UseGuards(JwtAuthGuard)
export class WatchHistoryController {
  constructor(private readonly history: WatchHistoryService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.history.list(user.id);
  }

  @Post()
  upsert(@CurrentUser() user: AuthUser, @Body() body: WatchHistoryUpsertDto) {
    return this.history.upsert(user.id, body);
  }

  @Post('batch')
  upsertMany(@CurrentUser() user: AuthUser, @Body() body: WatchHistoryBatchDto) {
    return this.history.upsertMany(user.id, body.items);
  }

  @Delete(':movieSlug/:episodeName')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('movieSlug') movieSlug: string,
    @Param('episodeName') episodeName: string,
  ) {
    return this.history.remove(user.id, movieSlug, decodeURIComponent(episodeName));
  }

  @Delete()
  clear(@CurrentUser() user: AuthUser) {
    return this.history.clear(user.id);
  }
}
