import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { WrappedService } from './wrapped.service';

@ApiTags('Wrapped')
@ApiBearerAuth()
@Controller('api/wrapped')
export class WrappedController {
  constructor(private readonly wrapped: WrappedService) {}
  @Get()
  @ApiOperation({ summary: 'Year in review from my watch history' })
  @ApiQuery({ name: 'year', required: false })
  forMe(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    const current = new Date(Date.now() + 7 * 3600_000).getUTCFullYear();
    const y = Number(year);
    return this.wrapped.forUser(
      user.id,
      Number.isInteger(y) && y >= 2020 && y <= current ? y : current,
    );
  }
}
