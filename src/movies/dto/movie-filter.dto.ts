import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { MOVIE_TYPES } from '../../shared/constants/movie-types.constant';
import { PAGINATION } from '../../shared/constants/pagination.constant';
import {
  SORT_FIELDS,
  SORT_LANGS,
  SORT_TYPES,
} from '../../shared/constants/sort-options.constant';
import { SOURCE_KEYS } from '../sources/sources.registry';
import type { SourceKey } from '../sources/sources.registry';
import { PaginationDto } from '../../shared/dto/pagination.dto';

export class MovieFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: SOURCE_KEYS,
    description: 'Pin upstream source. Omit to use automatic fallback.',
  })
  @IsOptional()
  @IsIn(SOURCE_KEYS)
  source?: SourceKey;

  @ApiPropertyOptional({
    example: 'hanh-dong',
    description: 'Secondary genre slug filter',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: 'han-quoc',
    description: 'Secondary country slug filter',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    example: '2024',
    description: 'Release year (4 digits)',
  })
  @IsOptional()
  @IsString()
  year?: string;

  @ApiPropertyOptional({
    enum: SORT_LANGS,
    description: 'Filter by subtitle / dubbing type',
    example: 'vietsub',
  })
  @IsOptional()
  @IsIn(SORT_LANGS)
  sort_lang?: (typeof SORT_LANGS)[number];

  @ApiPropertyOptional({
    enum: SORT_FIELDS,
    description: 'Sort field',
    example: 'modified.time',
  })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort_field?: (typeof SORT_FIELDS)[number];

  @ApiPropertyOptional({
    enum: SORT_TYPES,
    description: 'Sort direction',
    example: 'desc',
  })
  @IsOptional()
  @IsIn(SORT_TYPES)
  sort_type?: (typeof SORT_TYPES)[number];
}

export class NewMoviesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: SOURCE_KEYS,
    description: 'Pin upstream source. Omit to use automatic fallback.',
  })
  @IsOptional()
  @IsIn(SOURCE_KEYS)
  source?: SourceKey;

  @ApiPropertyOptional({
    default: PAGINATION.defaultPage,
    minimum: PAGINATION.minPage,
    example: 1,
    description: 'Page number (starts at 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGINATION.minPage)
  page?: number = PAGINATION.defaultPage;
}

export const MOVIE_TYPE_API_ENUM = [...MOVIE_TYPES] as string[];
