import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { PublicRoomStatus, RoomControlMode } from '../../types';
import { ROOM_CONTROL_MODES } from '../room-control';
import { MAX_EPISODE_NAME_LENGTH, MAX_QUEUE_LENGTH } from '../room-media';

const PUBLIC_ROOM_STATUSES: readonly PublicRoomStatus[] = ['live', 'upcoming'];

export class EpisodeQueueItemDto {
  @ApiProperty({ description: 'Same value the room uses for episode_name.' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_EPISODE_NAME_LENGTH)
  episode_name!: string;
  @ApiProperty()
  @IsInt()
  @Min(0)
  server_index!: number;
}

export class CreateWatchRoomDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  code!: string;
  @ApiProperty()
  @IsString()
  movie_slug!: string;
  @ApiProperty()
  @IsString()
  movie_name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumb_url?: string | null;
  @ApiProperty()
  @IsString()
  episode_name!: string;
  @ApiProperty()
  @IsInt()
  server_index!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  expires_hours?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_private?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pin?: string | null;
  @ApiPropertyOptional({ enum: ROOM_CONTROL_MODES, default: 'host' })
  @IsOptional()
  @IsIn(ROOM_CONTROL_MODES)
  control_mode?: RoomControlMode;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  wait_for_buffering?: boolean;
  @ApiPropertyOptional({
    description: 'ISO time the watch party starts; future, within 7 days.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  scheduled_at?: string | null;
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;
  @ApiPropertyOptional({ type: [EpisodeQueueItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_QUEUE_LENGTH)
  @ValidateNested({ each: true })
  @Type(() => EpisodeQueueItemDto)
  episode_queue?: EpisodeQueueItemDto[];
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  auto_next?: boolean;
}

export class JoinWatchRoomDto {
  @ApiProperty()
  @IsString()
  username!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar_url?: string | null;
  @ApiPropertyOptional({ description: 'Required when the room is private.' })
  @IsOptional()
  @IsString()
  pin?: string | null;
  @ApiProperty()
  @IsString()
  joined_message!: string;
}

export class SendRoomMessageDto {
  @ApiProperty()
  @IsString()
  username!: string;
  @ApiProperty()
  @IsString()
  content!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar_url?: string | null;
  @ApiPropertyOptional({
    description: 'Seconds into the episode when the message was sent.',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  playback_time?: number | null;
  @ApiPropertyOptional({
    description:
      'Also publish as a danmaku comment on the episode (needs playback_time).',
  })
  @IsOptional()
  @IsBoolean()
  as_danmaku?: boolean;
}

export class UpdatePlaybackDto {
  @ApiProperty()
  @IsInt()
  playback_time!: number;
  @ApiProperty()
  @IsBoolean()
  is_playing!: boolean;
  @ApiProperty()
  @IsString()
  episode_name!: string;
  @ApiProperty()
  @IsInt()
  server_index!: number;
}

export class UpdateRoomSettingsDto {
  @ApiPropertyOptional({ enum: ROOM_CONTROL_MODES })
  @IsOptional()
  @IsIn(ROOM_CONTROL_MODES)
  control_mode?: RoomControlMode;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  wait_for_buffering?: boolean;
}

export class TransferHostDto {
  @ApiProperty()
  @IsUUID()
  user_id!: string;
}

export class UpdateQueueDto {
  @ApiProperty({ type: [EpisodeQueueItemDto] })
  @IsArray()
  @ArrayMaxSize(MAX_QUEUE_LENGTH)
  @ValidateNested({ each: true })
  @Type(() => EpisodeQueueItemDto)
  items!: EpisodeQueueItemDto[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auto_next?: boolean;
}

export class PublicRoomsQueryDto {
  @ApiPropertyOptional({ enum: PUBLIC_ROOM_STATUSES, default: 'live' })
  @IsOptional()
  @IsIn(PUBLIC_ROOM_STATUSES)
  status?: PublicRoomStatus;
  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
