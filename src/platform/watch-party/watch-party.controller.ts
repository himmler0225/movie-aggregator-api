import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  SendRoomMessageDto,
  UpdatePlaybackDto,
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
    });
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
