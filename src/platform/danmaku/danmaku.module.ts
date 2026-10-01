import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../database/repositories/repositories.module';
import { AuthModule } from '../auth/auth.module';
import { DanmakuController } from './danmaku.controller';
import { DanmakuService } from './danmaku.service';

@Module({
  imports: [RepositoriesModule, AuthModule],
  controllers: [DanmakuController],
  providers: [DanmakuService],
  exports: [DanmakuService],
})
export class DanmakuModule {}
