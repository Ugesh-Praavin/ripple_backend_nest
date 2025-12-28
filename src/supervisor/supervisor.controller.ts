import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  Get,
  ForbiddenException,
} from '@nestjs/common';

import { ReportsService } from '../reports/reports.service';
import { FirebaseAuthGuard } from 'src/auth/guard/firebase.guard';
import { RequestUser } from '../reports/reports.types';
import { CompleteReportDto } from './dto/complete-report.dto';

@Controller('supervisor')
@UseGuards(FirebaseAuthGuard)
export class SupervisorController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('reports')
  getReports(@Req() req: { user: RequestUser }) {
    if (req.user.role !== 'SUPERVISOR') {
      throw new ForbiddenException('Supervisor access required');
    }
    return this.reportsService.getSupervisorReports(req.user);
  }

  @Patch('report/:id/assign-worker')
  assignWorker(
    @Param('id') reportId: string,
    @Body('worker_name') workerName: string,
    @Req() req: { user: RequestUser },
  ) {
    if (req.user.role !== 'SUPERVISOR') {
      throw new ForbiddenException('Supervisor access required');
    }
    return this.reportsService.assignWorker(reportId, workerName, req.user);
  }

  @Patch('report/:id/complete')
  completeReport(
    @Param('id') reportId: string,
    @Body() body: CompleteReportDto,
    @Req() req: { user: RequestUser },
  ) {
    if (req.user.role !== 'SUPERVISOR') {
      throw new ForbiddenException('Supervisor access required');
    }

    // Validation is handled by class-validator decorators in CompleteReportDto
    // ValidationPipe will automatically validate and throw BadRequestException if invalid
    return this.reportsService.completeReport(
      reportId,
      body.image_url,
      req.user,
    );
  }
}
