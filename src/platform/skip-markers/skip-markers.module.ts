import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { SkipMarkersController } from './skip-markers.controller';
import { SkipMarkersService } from './skip-markers.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [SkipMarkersController],
  providers: [SkipMarkersService],
})
export class SkipMarkersModule {}
