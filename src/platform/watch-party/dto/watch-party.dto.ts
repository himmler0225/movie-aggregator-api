import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

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
}

export class JoinWatchRoomDto {
  @ApiProperty()
  @IsString()
  username!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar_url?: string | null;

  @ApiProperty()
  @IsString()
  host_id!: string;

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
