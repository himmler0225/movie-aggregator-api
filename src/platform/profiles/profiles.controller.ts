import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateProfileDto } from './dto/profiles.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('Profiles')
@ApiBearerAuth()
@Controller('api/profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.profiles.getProfile(user.id);
  }

  @Public()
  @Get(':userId')
  get(@Param('userId') userId: string) {
    return this.profiles.getProfile(userId);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateProfileDto) {
    return this.profiles.updateProfile(user.id, body);
  }
}
