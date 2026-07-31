import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AddFavoriteDto {
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
}

export class FavoriteBatchDto {
  @ApiProperty({ type: [AddFavoriteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddFavoriteDto)
  items!: AddFavoriteDto[];
}
