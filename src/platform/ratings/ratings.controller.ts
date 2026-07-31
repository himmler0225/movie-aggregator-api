import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { UpsertRatingDto } from './dto/ratings.dto';
import { RatingsService } from './ratings.service';

@ApiTags('Ratings')
@Controller('api/ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}
  @Public()
  @Get('movie/:slug/aggregate')
  aggregate(
    @Param('slug')
    slug: string,
  ) {
    return this.ratings.getAggregate(slug);
  }
  @ApiBearerAuth()
  @Get('movie/:slug')
  userRating(
    @CurrentUser()
    user: AuthUser,
    @Param('slug')
    slug: string,
  ) {
    return this.ratings.getUserRating(user.id, slug);
  }
  @ApiBearerAuth()
  @Put('movie/:slug')
  upsert(
    @CurrentUser()
    user: AuthUser,
    @Param('slug')
    slug: string,
    @Body()
    body: UpsertRatingDto,
  ) {
    return this.ratings.upsert(user.id, slug, body.score);
  }
}
