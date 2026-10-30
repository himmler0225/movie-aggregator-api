import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const SKIP_KINDS = ['intro', 'outro'] as const;

/** Longest segment anyone can mark (10 minutes). */
export const SKIP_MAX_LENGTH_SEC = 600;

export class CreateSkipMarkDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  movie_slug!: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  episode_name!: string;
  @ApiProperty({ enum: SKIP_KINDS })
  @IsIn(SKIP_KINDS)
  kind!: (typeof SKIP_KINDS)[number];
  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(6 * 3600)
  start_sec!: number;
  @ApiProperty()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(6 * 3600)
  end_sec!: number;
}

export class SkipMarksQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  episode!: string;
}

export class DeleteSkipMarkQueryDto extends SkipMarksQueryDto {
  @ApiProperty({ enum: SKIP_KINDS })
  @IsIn(SKIP_KINDS)
  kind!: (typeof SKIP_KINDS)[number];
}
