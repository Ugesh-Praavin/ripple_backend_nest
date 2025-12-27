import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { admin } from 'src/admin/firebase-admin';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = await admin.auth().verifyIdToken(token);

      if (!decoded.email) {
        throw new UnauthorizedException('Email not found in token');
      }

      const { data: user, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('role, block_id')
        .eq('email', decoded.email)
        .single();

      if (error || !user) {
        throw new UnauthorizedException('User not found in database');
      }

      // Attach complete user object to request
      request.user = {
        uid: decoded.uid,
        email: decoded.email,
        role: user.role,
        block_id: user.block_id,
      };

      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      throw new UnauthorizedException('Invalid Firebase token');
    }
  }
}
