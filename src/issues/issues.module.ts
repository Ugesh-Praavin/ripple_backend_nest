import { Module } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { MlModule } from 'src/ml/ml.module';

@Module({
  imports: [SupabaseModule, MlModule],
  providers: [IssuesService],
  controllers: [IssuesController],
  exports: [IssuesService],
})
export class IssuesModule {}
