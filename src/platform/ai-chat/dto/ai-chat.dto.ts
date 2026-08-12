import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AppendAiChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  actions?: unknown[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  videos?: unknown[];
}
