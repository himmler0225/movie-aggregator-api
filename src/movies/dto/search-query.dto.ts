import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SOURCE_KEYS } from '../sources/sources.registry';
import type { SourceKey } from '../sources/sources.registry';
import { PaginationDto } from '../../shared/dto/pagination.dto';

export class SearchQueryDto extends PaginationDto {
  @ApiProperty({
    example: 'one piece',
    description:
      'Search keyword (required). OPhim also supports actor name search.',
  })
  @IsNotEmpty({ message: 'Missing required query parameter: keyword' })
  @IsString()
  keyword!: string;

  @ApiPropertyOptional({
    enum: SOURCE_KEYS,
    description: 'Pin upstream source. Omit to use automatic fallback.',
  })
  @IsOptional()
  @IsIn(SOURCE_KEYS)
  source?: SourceKey;
}
