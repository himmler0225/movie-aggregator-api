import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { QUERY_LIMITS } from '../../../shared/constants';

export const DANMAKU_MAX_LENGTH = 200;

export class CreateDanmakuDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  movie_slug!: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  episode_name!: string;
  @ApiProperty({ description: 'Seconds into the episode.' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  playback_time!: number;
  @ApiProperty({ maxLength: DANMAKU_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(DANMAKU_MAX_LENGTH)
  content!: string;
}

export class ListDanmakuQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  episode!: string;
  @ApiPropertyOptional({ description: 'Start of the window, in seconds.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  from?: number;
  @ApiPropertyOptional({ description: 'End of the window (exclusive).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  to?: number;
  @ApiPropertyOptional({
    default: QUERY_LIMITS.danmakuDefault,
    maximum: QUERY_LIMITS.danmakuMax,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(QUERY_LIMITS.danmakuMax)
  limit?: number;
}
