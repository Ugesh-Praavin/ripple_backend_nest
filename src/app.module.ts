import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { SupervisorModule } from './supervisor/supervisor.module';
import { BlocksModule } from './blocks/blocks.module';
import { MlModule } from './ml/ml.module';
import { CommonModule } from './common/common.module';
import { SupabaseModule } from './supabase/supabase.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    SupervisorModule,
    BlocksModule,
    MlModule,
    CommonModule,
    SupabaseModule,
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available everywhere
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
