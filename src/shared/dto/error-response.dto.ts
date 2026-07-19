import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    example: 'Unable to load data. Please try again later.',
    description: 'Error message',
  })
  error!: string;
}
