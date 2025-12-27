import { Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { AuthModule } from 'src/auth/auth.module';
import { ReportsModule } from 'src/reports/reports.module';
import * as admin from 'firebase-admin';

@Module({
  controllers: [AdminController],
  imports: [SupabaseModule, AuthModule, ReportsModule, ConfigModule],
  providers: [
    {
      provide: 'FIREBASE_APP',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // --- DEBUGGING START ---
        const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKey = configService.get<string>('FIREBASE_PRIVATE_KEY');

        console.log('🔍 DEBUG: Loading Firebase Config...');
        console.log('   - Project ID:', projectId);
        console.log('   - Client Email:', clientEmail); // If this is undefined, that's the error
        console.log('   - Private Key exists:', !!privateKey);
        // --- DEBUGGING END ---

        const firebaseConfig = {
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey?.replace(/\\n/g, '\n'),
          }),
        };

        return admin.apps.length
          ? admin.app()
          : admin.initializeApp(firebaseConfig);
      },
    },
  ],
  exports: ['FIREBASE_APP'],
})
export class AdminModule {}
