import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../database/repositories/repositories.module';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AuthModule } from './auth/auth.module';
import { CommentsController } from './comments/comments.controller';
import { CommentsService } from './comments/comments.service';
import { FavoritesController } from './favorites/favorites.controller';
import { FavoritesService } from './favorites/favorites.service';
import { ProfilesController } from './profiles/profiles.controller';
import { ProfilesService } from './profiles/profiles.service';
import { RatingsController } from './ratings/ratings.controller';
import { RatingsService } from './ratings/ratings.service';
import { WatchHistoryController } from './watch-history/watch-history.controller';
import { WatchHistoryService } from './watch-history/watch-history.service';
import { WatchPartyController } from './watch-party/watch-party.controller';
import { WatchPartyGateway } from './watch-party/watch-party.gateway';
import { WatchPartyService } from './watch-party/watch-party.service';
import { WatchlistsController } from './watchlists/watchlists.controller';
import { WatchlistsService } from './watchlists/watchlists.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [
    CommentsController,
    FavoritesController,
    ProfilesController,
    RatingsController,
    WatchHistoryController,
    WatchlistsController,
    WatchPartyController,
    AdminController,
  ],
  providers: [
    CommentsService,
    FavoritesService,
    ProfilesService,
    RatingsService,
    WatchHistoryService,
    WatchlistsService,
    WatchPartyService,
    WatchPartyGateway,
    AdminService,
  ],
})
export class PlatformModule {}
