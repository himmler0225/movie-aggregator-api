import { Global, Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
