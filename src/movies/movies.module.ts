import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UpstreamClientService } from '../upstream/upstream-client.service';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';

@Module({
  imports: [
    HttpModule.register({
      maxRedirects: 5,
    }),
  ],
  controllers: [MoviesController],
  providers: [UpstreamClientService, MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
