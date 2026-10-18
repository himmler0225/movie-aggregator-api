import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [PreferencesController],
  providers: [PreferencesService],
})
export class PreferencesModule {}
