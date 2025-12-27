import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { MlModule } from '../ml/ml.module';

@Module({
  imports: [SupabaseModule, MlModule],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

