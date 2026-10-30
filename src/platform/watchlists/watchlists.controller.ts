import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../types';
import { CurrentUser, Public } from '../auth/auth.decorators';
import { SaveWatchlistsDto, ShareWatchlistDto } from './dto/watchlists.dto';
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
  @Put(':listKey/share')
  share(
    @CurrentUser()
    user: AuthUser,
    @Param('listKey')
    listKey: string,
    @Body()
    body: ShareWatchlistDto,
  ) {
    return this.watchlists.setSharing(user.id, listKey, body.public);
  }
  @Public()
  @Get('shared/:shareId')
  shared(
    @Param('shareId')
    shareId: string,
  ) {
    return this.watchlists.getShared(shareId);
  }
}
