import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  movie_slug!: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_spoiler?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  episode_name?: string | null;
}
