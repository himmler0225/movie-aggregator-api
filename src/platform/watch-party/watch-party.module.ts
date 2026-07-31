import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { WatchPartyController } from './watch-party.controller';
import { WatchPartyGateway } from './watch-party.gateway';
import { WatchPartyService } from './watch-party.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [WatchPartyController],
  providers: [WatchPartyService, WatchPartyGateway],
  exports: [WatchPartyService],
})
export class WatchPartyModule {}
