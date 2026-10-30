import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { DanmakuModule } from './danmaku/danmaku.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MomentsModule } from './moments/moments.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RatingsModule } from './ratings/ratings.module';
import { WatchHistoryModule } from './watch-history/watch-history.module';
import { WatchPartyModule } from './watch-party/watch-party.module';
import { PreferencesModule } from './preferences/preferences.module';
import { PushModule } from './push/push.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SkipMarkersModule } from './skip-markers/skip-markers.module';
import { WatchlistsModule } from './watchlists/watchlists.module';

@Module({
  imports: [
    AuthModule,
    FavoritesModule,
    CommentsModule,
    DanmakuModule,
    MomentsModule,
    ProfilesModule,
    RatingsModule,
    WatchHistoryModule,
    WatchlistsModule,
    PreferencesModule,
    SkipMarkersModule,
    PushModule,
    RecommendationsModule,
    WatchPartyModule,
    AdminModule,
    AnalyticsModule,
  ],
})
export class PlatformModule {}
