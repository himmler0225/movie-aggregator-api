import { Module } from '@nestjs/common';
import { MoviesModule } from '../../movies/movies.module';
import { AuthModule } from '../auth/auth.module';
import { WrappedController } from './wrapped.controller';
import { WrappedService } from './wrapped.service';

@Module({
  imports: [AuthModule, MoviesModule],
  controllers: [WrappedController],
  providers: [WrappedService],
})
export class WrappedModule {}
