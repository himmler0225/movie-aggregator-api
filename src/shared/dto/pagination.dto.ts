import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PAGINATION } from '../constants/pagination.constant';

export class PaginationDto {
  @ApiPropertyOptional({
    default: PAGINATION.defaultPage,
    minimum: PAGINATION.minPage,
    description: 'Page number (starts at 1)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGINATION.minPage)
  page?: number = PAGINATION.defaultPage;
  @ApiPropertyOptional({
    default: PAGINATION.defaultLimit,
    minimum: PAGINATION.minPage,
    maximum: PAGINATION.maxLimit,
    description: 'Number of items per page',
    example: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGINATION.minPage)
  @Max(PAGINATION.maxLimit)
  limit?: number = PAGINATION.defaultLimit;
}
