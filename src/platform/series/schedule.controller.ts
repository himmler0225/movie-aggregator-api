import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { ScheduleService } from './schedule.service';

@ApiTags('Schedule')
@ApiBearerAuth()
@Controller('api/schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}
  @Get()
  @ApiOperation({
    summary: 'Followed ongoing series with learned release days',
  })
  forMe(@CurrentUser() user: AuthUser) {
    return this.schedule.forUser(user.id);
  }
}
