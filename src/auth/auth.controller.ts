import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from './guard/firebase.guard';
import type { RequestUser } from '../reports/reports.types';

@Controller('auth')
@UseGuards(FirebaseAuthGuard)
export class AuthController {
  @Get('me')
  getMe(@Req() req: { user: RequestUser }): RequestUser {
    return req.user;
  }
}
