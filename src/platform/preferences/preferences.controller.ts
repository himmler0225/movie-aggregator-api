import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { UpdatePreferencesDto } from './dto/preferences.dto';
import { PreferencesService } from './preferences.service';

@ApiTags('Preferences')
@ApiBearerAuth()
@Controller('api/preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}
  @Get()
  get(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.preferences.get(user.id);
  }
  @Patch()
  update(
    @CurrentUser()
    user: AuthUser,
    @Body()
    body: UpdatePreferencesDto,
  ) {
    return this.preferences.update(user.id, body.data);
  }
}
