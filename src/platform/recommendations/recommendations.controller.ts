import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { RecommendationsService } from './recommendations.service';

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller('api/recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}
  @Get()
  @ApiOperation({
    summary: '"For you" picks based on history, favourites and ratings',
  })
  forMe(@CurrentUser() user: AuthUser) {
    return this.recommendations.forUser(user.id);
  }
}
