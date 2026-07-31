import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser } from '../auth/auth.decorators';
import { SaveWatchlistsDto } from './dto/watchlists.dto';
import { WatchlistsService } from './watchlists.service';

@ApiTags('Watchlists')
@ApiBearerAuth()
@Controller('api/watchlists')
export class WatchlistsController {
  constructor(private readonly watchlists: WatchlistsService) {}
  @Get()
  list(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.watchlists.list(user.id);
  }
  @Put()
  save(
    @CurrentUser()
    user: AuthUser,
    @Body()
    body: SaveWatchlistsDto,
  ) {
    return this.watchlists.saveAll(user.id, body.lists);
  }
}
