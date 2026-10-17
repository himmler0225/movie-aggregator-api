import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UpstreamClientService } from '../upstream/upstream-client.service';
import { MoviesController } from './movies.controller';
import { MovieCacheService } from './movie-cache.service';
import { MoviesService } from './movies.service';

@Module({
  imports: [
    HttpModule.register({
      maxRedirects: 5,
    }),
  ],
  controllers: [MoviesController],
  providers: [UpstreamClientService, MovieCacheService, MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
