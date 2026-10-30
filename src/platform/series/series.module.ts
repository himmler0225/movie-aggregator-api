import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { MoviesModule } from '../../movies/movies.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { NewEpisodeNotifierService } from './new-episode-notifier.service';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { TrackedSeriesService } from './tracked-series.service';

@Module({
  imports: [RepositoriesModule, AuthModule, MoviesModule, PushModule],
  controllers: [ScheduleController],
  providers: [TrackedSeriesService, NewEpisodeNotifierService, ScheduleService],
})
export class SeriesModule {}
