import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';
import {
  MAX_REACTION_TIME_SECONDS,
  REACTION_EMOJIS,
} from '../moments.constants';

export class HeatmapQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  episode!: string;
}

export class CreateReactionDto {
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
  @Max(MAX_REACTION_TIME_SECONDS)
  time!: number;
  @ApiProperty({ enum: REACTION_EMOJIS })
  @IsIn(REACTION_EMOJIS)
  emoji!: string;
}
