import { Module } from '@nestjs/common';
import { MoviesModule } from '../../movies/movies.module';
import { AuthModule } from '../auth/auth.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [AuthModule, MoviesModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
