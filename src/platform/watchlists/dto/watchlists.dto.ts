import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';

export class WatchlistItemDto {
  @ApiProperty()
  @IsString()
  id!: string;
  @ApiProperty()
  @IsString()
  name!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  slugs!: string[];
  @ApiProperty()
  @IsInt()
  createdAt!: number;
}

export class SaveWatchlistsDto {
  @ApiProperty({ type: [WatchlistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WatchlistItemDto)
  lists!: WatchlistItemDto[];
}
