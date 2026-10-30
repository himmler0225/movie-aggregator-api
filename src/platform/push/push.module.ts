import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { MoviesModule } from '../../movies/movies.module';
import { AuthModule } from '../auth/auth.module';
import { NewEpisodeNotifierService } from './new-episode-notifier.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [RepositoriesModule, AuthModule, MoviesModule],
  controllers: [PushController],
  providers: [PushService, NewEpisodeNotifierService],
  exports: [PushService],
})
export class PushModule {}
