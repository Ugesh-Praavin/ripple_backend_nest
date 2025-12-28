import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { MlModule } from '../ml/ml.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [SupabaseModule, MlModule, NotificationModule],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
