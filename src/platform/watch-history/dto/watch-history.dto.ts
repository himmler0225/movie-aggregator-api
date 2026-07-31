import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class WatchHistoryUpsertDto {
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
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  episode_index?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  server_index?: number;
  @ApiProperty()
  @IsNumber()
  @Min(0)
  progress_sec!: number;
  @ApiProperty()
  @IsNumber()
  @Min(0)
  duration_sec!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  watched_at?: string;
}

export class WatchHistoryBatchDto {
  @ApiProperty({ type: [WatchHistoryUpsertDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WatchHistoryUpsertDto)
  items!: WatchHistoryUpsertDto[];
}
