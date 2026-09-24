import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { DanmakuModule } from '../danmaku/danmaku.module';
import { WatchPartyController } from './watch-party.controller';
import { WatchPartyGateway } from './watch-party.gateway';
import { WatchPartyService } from './watch-party.service';
import { WatchPartyStore } from './watch-party.store';

@Module({
  imports: [RepositoriesModule, AuthModule, DanmakuModule],
  controllers: [WatchPartyController],
  providers: [WatchPartyService, WatchPartyGateway, WatchPartyStore],
  exports: [WatchPartyService],
})
export class WatchPartyModule {}
