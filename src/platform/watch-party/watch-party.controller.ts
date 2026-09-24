import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { RATE_LIMIT } from '../../shared/constants';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import {
  CreateWatchRoomDto,
  JoinWatchRoomDto,
  PublicRoomsQueryDto,
  SendRoomMessageDto,
  TransferHostDto,
  UpdatePlaybackDto,
  UpdateQueueDto,
  UpdateRoomSettingsDto,
} from './dto/watch-party.dto';
import { WatchPartyService } from './watch-party.service';

@ApiTags('Watch Party')
@Controller('api/watch-party')
export class WatchPartyController {
  constructor(private readonly watchParty: WatchPartyService) {}
  @ApiBearerAuth()
  @Post('rooms')
  create(
    @CurrentUser()
    user: AuthUser,
    @Body()
    body: CreateWatchRoomDto,
  ) {
    return this.watchParty.createRoom({
      code: body.code,
      hostId: user.id,
      hostRole: user.role,
      movieSlug: body.movie_slug,
      movieName: body.movie_name,
      thumbUrl: body.thumb_url,
      episodeName: body.episode_name,
      serverIndex: body.server_index,
      expiresHours: body.expires_hours,
      isPrivate: body.is_private,
      pin: body.pin,
      controlMode: body.control_mode,
      waitForBuffering: body.wait_for_buffering,
      scheduledAt: body.scheduled_at ? new Date(body.scheduled_at) : null,
      title: body.title,
      episodeQueue: body.episode_queue?.map((i) => ({
        episode_name: i.episode_name,
        server_index: i.server_index,
      })),
      autoNext: body.auto_next,
    });
  }
  // Declared before rooms/:code so "public" is not read as a room code.
  @Public()
  @Get('rooms/public')
  publicRooms(
    @Query()
    query: PublicRoomsQueryDto,
  ) {
    return this.watchParty.listPublicRooms(
      query.status ?? 'live',
      query.limit ?? 20,
    );
  }
  @ApiBearerAuth()
  @Get('reminders/me')
  myReminders(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.watchParty.listMyReminders(user.id);
  }
  @Public()
  @Get('rooms/:code/preview')
  preview(
    @Param('code')
    code: string,
  ) {
    return this.watchParty.fetchRoomByCode(code);
  }
  @Public()
  @Get('rooms/:code')
  getRoom(
    @Param('code')
    code: string,
  ) {
    return this.watchParty.fetchRoomFull(code);
  }
  @ApiBearerAuth()
  @Get('rooms/:roomId/members')
  members(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
  ) {
    return this.watchParty.fetchMembers(roomId, user.id);
  }
  @ApiBearerAuth()
  @Get('rooms/:roomId/messages')
  messages(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Query('limit')
    limit?: string,
  ) {
    return this.watchParty.fetchMessages(
      roomId,
      user.id,
      limit ? Number(limit) : undefined,
    );
  }
  @ApiBearerAuth()
  @Post('rooms/:roomId/join')
  @UseGuards(RateLimitGuard)
  @RateLimit(RATE_LIMIT.watchPartyJoin)
  join(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Body()
    body: JoinWatchRoomDto,
  ) {
    return this.watchParty.joinAsGuest(
      roomId,
      user.id,
      body.username,
      body.avatar_url ?? null,
      body.pin,
      body.joined_message,
    );
  }
  @ApiBearerAuth()
  @Post('rooms/:roomId/messages')
  sendMessage(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Body()
    body: SendRoomMessageDto,
  ) {
    return this.watchParty.insertMessage({
      roomId,
      userId: user.id,
      username: body.username,
      content: body.content,
      type: body.type,
      avatarUrl: body.avatar_url,
      playbackTime: body.playback_time,
      asDanmaku: body.as_danmaku,
    });
  }
  @ApiBearerAuth()
  @Patch('rooms/:roomId/playback')
  updatePlayback(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Body()
    body: UpdatePlaybackDto,
  ) {
    return this.watchParty.updatePlayback(roomId, user.id, {
      playbackTime: body.playback_time,
      isPlaying: body.is_playing,
      episodeName: body.episode_name,
      serverIndex: body.server_index,
    });
  }
  @ApiBearerAuth()
  @Put('rooms/:roomId/queue')
  updateQueue(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Body()
    body: UpdateQueueDto,
  ) {
    return this.watchParty.updateQueue(roomId, user.id, {
      items: body.items.map((i) => ({
        episode_name: i.episode_name,
        server_index: i.server_index,
      })),
      autoNext: body.auto_next,
    });
  }
  @ApiBearerAuth()
  @Put('rooms/:roomId/reminder')
  remindMe(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
  ) {
    return this.watchParty.remindMe(roomId, user.id);
  }
  @ApiBearerAuth()
  @Delete('rooms/:roomId/reminder')
  cancelReminder(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
  ) {
    return this.watchParty.cancelReminder(roomId, user.id);
  }
  @ApiBearerAuth()
  @Patch('rooms/:roomId/settings')
  updateSettings(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Body()
    body: UpdateRoomSettingsDto,
  ) {
    return this.watchParty.updateSettings(roomId, user.id, {
      controlMode: body.control_mode,
      waitForBuffering: body.wait_for_buffering,
    });
  }
  @ApiBearerAuth()
  @Put('rooms/:roomId/co-hosts/:userId')
  addCoHost(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Param('userId', ParseUUIDPipe)
    userId: string,
  ) {
    return this.watchParty.addCoHost(roomId, user.id, userId);
  }
  @ApiBearerAuth()
  @Delete('rooms/:roomId/co-hosts/:userId')
  removeCoHost(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Param('userId', ParseUUIDPipe)
    userId: string,
  ) {
    return this.watchParty.removeCoHost(roomId, user.id, userId);
  }
  @ApiBearerAuth()
  @Post('rooms/:roomId/host')
  transferHost(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
    @Body()
    body: TransferHostDto,
  ) {
    return this.watchParty.transferHost(roomId, user.id, body.user_id);
  }
  @ApiBearerAuth()
  @Delete('rooms/:roomId/members/me')
  leave(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
  ) {
    return this.watchParty.removeMember(roomId, user.id);
  }
  @ApiBearerAuth()
  @Delete('rooms/:roomId')
  close(
    @CurrentUser()
    user: AuthUser,
    @Param('roomId')
    roomId: string,
  ) {
    return this.watchParty.deleteRoom(roomId, user.id);
  }
}
