import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddFavoriteDto, FavoriteBatchDto } from './dto/favorites.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('api/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.favorites.list(user.id);
  }

  @Get('slugs')
  slugs(@CurrentUser() user: AuthUser) {
    return this.favorites.slugMap(user.id);
  }

  @Get('count')
  count(@CurrentUser() user: AuthUser) {
    return this.favorites.count(user.id);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() body: AddFavoriteDto) {
    return this.favorites.add(user.id, {
      movieSlug: body.movie_slug,
      movieName: body.movie_name,
      thumbUrl: body.thumb_url,
    });
  }

  @Post('batch')
  addMany(@CurrentUser() user: AuthUser, @Body() body: FavoriteBatchDto) {
    return this.favorites.addMany(
      user.id,
      body.items.map((i) => ({
        movieSlug: i.movie_slug,
        movieName: i.movie_name,
        thumbUrl: i.thumb_url,
      })),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.favorites.remove(id);
  }

  @Delete('slug/:movieSlug')
  removeBySlug(@CurrentUser() user: AuthUser, @Param('movieSlug') movieSlug: string) {
    return this.favorites.removeBySlug(user.id, movieSlug);
  }
}
