import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { MoviesModule } from '../../movies/movies.module';
import { DanmakuModule } from '../danmaku/danmaku.module';
import { MomentsModule } from '../moments/moments.module';
import { WatchPartyController } from './watch-party.controller';
import { WatchPartyGateway } from './watch-party.gateway';
import { WatchPartyService } from './watch-party.service';
import { WatchPartyStore } from './watch-party.store';
import { WatchPartySchedulerService } from './watch-party-scheduler.service';

@Module({
  imports: [
    RepositoriesModule,
    AuthModule,
    DanmakuModule,
    MomentsModule,
    MoviesModule,
  ],
  controllers: [WatchPartyController],
  providers: [
    WatchPartyService,
    WatchPartyGateway,
    WatchPartyStore,
    WatchPartySchedulerService,
  ],
  exports: [WatchPartyService],
})
export class WatchPartyModule {}
