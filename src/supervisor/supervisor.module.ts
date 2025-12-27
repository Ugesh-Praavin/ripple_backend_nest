import { Module } from '@nestjs/common';
import { SupervisorController } from './supervisor.controller';
import { AuthModule } from 'src/auth/auth.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { ReportsModule } from 'src/reports/reports.module';

@Module({
  controllers: [SupervisorController],
  imports: [SupabaseModule, AuthModule, ReportsModule],
})
export class SupervisorModule {}
