import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class WatchlistItemDto {
  @ApiProperty()
  @IsString()
  id!: string;
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  slugs!: string[];
  @ApiProperty()
  @IsInt()
  createdAt!: number;
}

export class SaveWatchlistsDto {
  @ApiProperty({ type: [WatchlistItemDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WatchlistItemDto)
  lists!: WatchlistItemDto[];
}
