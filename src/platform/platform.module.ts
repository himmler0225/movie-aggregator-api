import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RatingsModule } from './ratings/ratings.module';
import { WatchHistoryModule } from './watch-history/watch-history.module';
import { WatchPartyModule } from './watch-party/watch-party.module';
import { WatchlistsModule } from './watchlists/watchlists.module';

@Module({
  imports: [
    AuthModule,
    FavoritesModule,
    CommentsModule,
    ProfilesModule,
    RatingsModule,
    WatchHistoryModule,
    WatchlistsModule,
    WatchPartyModule,
    AiChatModule,
    AdminModule,
    AnalyticsModule,
  ],
})
export class PlatformModule {}
