import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  Get,
  Req,
  ForbiddenException,
} from '@nestjs/common';

import { ReportsService } from '../reports/reports.service';
import { FirebaseAuthGuard } from 'src/auth/guard/firebase.guard';
import { RequestUser } from '../reports/reports.types';

@Controller('admin')
@UseGuards(FirebaseAuthGuard)
export class AdminController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('me')
  getMe(@Req() req: { user: RequestUser }) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return req.user;
  }

  @Get('reports')
  getAllReports(@Req() req: { user: RequestUser }) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.reportsService.getAllReports();
  }

  @Patch('report/:id/start')
  async startReport(
    @Param('id') reportId: string,
    @Body('estimated_time') estimated_time: string,
    @Body('supervisor_id') supervisorId?: string,
    @Req() req?: { user: RequestUser },
  ): Promise<unknown> {
    if (req?.user && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.reportsService.startReport(
      reportId,
      estimated_time,
      supervisorId,
    );
  }
}
