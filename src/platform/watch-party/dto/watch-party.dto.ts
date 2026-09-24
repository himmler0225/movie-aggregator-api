import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import type { RoomControlMode } from '../../types';
import { ROOM_CONTROL_MODES } from '../room-control';

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
