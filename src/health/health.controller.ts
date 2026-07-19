import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Health')
@Controller('api')
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'Service is healthy',
    schema: {
      example: { ok: true, service: 'movie-aggregator-api' },
    },
  })
  health(): HealthResponseDto {
    return { ok: true, service: 'movie-aggregator-api' };
  }
}
