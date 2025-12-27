import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MLService } from 'src/ml/ml.service';
import { Report, RequestUser, MLPrediction } from './reports.types';

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mlService: MLService,
  ) {}

  /**
   * Admin workflow: Start working on a report
   * - Change status to "In Progress"
   * - Set estimated_resolution_time
   * - Optionally assign supervisor
   */
  async startReport(
    reportId: string,
    estimated_time: string,
    supervisorId?: string,
  ): Promise<Report> {
    const { data: report, error: fetchError } = await this.supabase
      .getClient()
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      throw new BadRequestException('Report not found');
    }

    const typedReport = report as Report;

    // Only allow if status is "Pending"
    if (typedReport.status !== 'Pending') {
      throw new BadRequestException(
        `Cannot start report. Current status: ${typedReport.status}. Only "Pending" reports can be started.`,
      );
    }

    const updateData: Partial<Report> = {
      status: 'In Progress',
      estimated_resolution_time: estimated_time,
      updated_at: new Date().toISOString(),
    };

    if (supervisorId) {
      updateData.supervisor_id = supervisorId;
    }

    const { data: updatedReport, error: updateError } = await this.supabase
      .getClient()
      .from('reports')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single();

    if (updateError || !updatedReport) {
      throw new BadRequestException('Failed to update report');
    }

    return updatedReport as Report;
  }

  /**
   * Supervisor workflow: Assign a worker to a report
   */
  async assignWorker(
    reportId: string,
    workerName: string,
    user: RequestUser,
  ): Promise<Report> {
    if (user.role !== 'SUPERVISOR') {
      throw new UnauthorizedException('Only supervisors can assign workers');
    }

    const { data: report, error: fetchError } = await this.supabase
      .getClient()
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      throw new BadRequestException('Report not found');
    }

    const typedReport = report as Report;

    // Verify supervisor has access to this report
    if (
      typedReport.supervisor_id &&
      typedReport.supervisor_id !== user.uid &&
      typedReport.supervisor_id !== user.block_id
    ) {
      throw new UnauthorizedException('You do not have access to this report');
    }

    const { data: updatedReport, error: updateError } = await this.supabase
      .getClient()
      .from('reports')
      .update({
        worker_name: workerName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (updateError || !updatedReport) {
      throw new BadRequestException('Failed to assign worker');
    }

    return updatedReport as Report;
  }

  /**
   * Supervisor workflow: Mark work as completed
   * - Upload resolved image (URL already uploaded to Supabase Storage)
   * - Trigger ML verification if applicable
   */
  async completeReport(
    reportId: string,
    resolvedImageUrl: string,
    user: RequestUser,
  ): Promise<Report | { status: string; requires_manual_review: boolean }> {
    if (user.role !== 'SUPERVISOR') {
      throw new UnauthorizedException('Only supervisors can complete reports');
    }

    const { data: report, error: fetchError } = await this.supabase
      .getClient()
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      throw new BadRequestException('Report not found');
    }

    const typedReport = report as Report;

    // Verify supervisor has access to this report
    if (
      typedReport.supervisor_id &&
      typedReport.supervisor_id !== user.uid &&
      typedReport.supervisor_id !== user.block_id
    ) {
      throw new UnauthorizedException('You do not have access to this report');
    }

    // Save resolved image URL
    const { data: updatedReport, error: updateError } = await this.supabase
      .getClient()
      .from('reports')
      .update({
        resolved_image_url: resolvedImageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .select()
      .single();

    if (updateError || !updatedReport) {
      throw new BadRequestException(
        'Failed to update report with resolved image',
      );
    }

    // Trigger ML verification if applicable
    return this.verifyReport(reportId, resolvedImageUrl);
  }

  /**
   * ML Verification workflow
   * - ML runs ONLY for: Pothole, Broken Street Light, Garbage Overflow, Drainage Overflow
   * - If ML confidence >= 70% → auto resolve
   * - Else → mark for manual review
   */
  async verifyReport(
    reportId: string,
    imageUrl: string,
  ): Promise<Report | { status: string; requires_manual_review: boolean }> {
    const { data: report, error: fetchError } = await this.supabase
      .getClient()
      .from('reports')
      .select('issue_type')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      throw new BadRequestException('Report not found');
    }

    const typedReport = report as Pick<Report, 'issue_type'>;

    // Check if this report type requires ML verification
    const mlSupportedTypes = [
      'Pothole',
      'Broken Street Light',
      'Garbage Overflow',
      'Drainage Overflow',
    ];

    const requiresML = mlSupportedTypes.includes(typedReport.issue_type);

    if (!requiresML) {
      // No ML verification needed, resolve directly
      return this.resolveReport(reportId);
    }

    // Call ML API
    const prediction: MLPrediction | null =
      await this.mlService.verifyImage(imageUrl);

    if (!prediction || prediction.confidence < 0.7) {
      // Low confidence or no prediction, mark for manual review
      await this.supabase
        .getClient()
        .from('reports')
        .update({
          status: 'Pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      // Store ML verification result even if low confidence
      if (prediction) {
        await this.supabase.getClient().from('ml_verification').insert({
          report_id: reportId,
          predicted_class: prediction.predicted_class,
          confidence: prediction.confidence,
          verified: false,
          verified_at: new Date().toISOString(),
        });
      }

      return { status: 'Pending', requires_manual_review: true };
    }

    // High confidence, auto-resolve
    return this.resolveReport(reportId, prediction);
  }

  /**
   * Resolve a report
   * - Update status to "Resolved"
   * - Save resolved_class (from ML if available)
   * - Save resolved_at timestamp
   */
  async resolveReport(
    reportId: string,
    mlResult?: MLPrediction,
  ): Promise<Report> {
    const resolveData: Partial<Report> = {
      status: 'Resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (mlResult) {
      resolveData.resolved_class = mlResult.predicted_class;
    }

    const { data: resolvedReport, error: resolveError } = await this.supabase
      .getClient()
      .from('reports')
      .update(resolveData)
      .eq('id', reportId)
      .select()
      .single();

    if (resolveError || !resolvedReport) {
      throw new BadRequestException('Failed to resolve report');
    }

    // Store ML verification result if available
    if (mlResult) {
      await this.supabase.getClient().from('ml_verification').insert({
        report_id: reportId,
        predicted_class: mlResult.predicted_class,
        confidence: mlResult.confidence,
        verified: true,
        verified_at: new Date().toISOString(),
      });
    }

    return resolvedReport as Report;
  }

  /**
   * Get all reports (Admin only)
   */
  async getAllReports(): Promise<Report[]> {
    const { data: reports, error } = await this.supabase
      .getClient()
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException('Failed to fetch reports');
    }

    return (reports as Report[]) || [];
  }

  /**
   * Get reports assigned to supervisor's block
   */
  async getSupervisorReports(user: RequestUser): Promise<Report[]> {
    if (user.role !== 'SUPERVISOR') {
      throw new UnauthorizedException('Only supervisors can view reports');
    }

    // Build query: status != "Resolved" AND (supervisor_id = current supervisor OR supervisor_id IS NULL)
    const query = this.supabase
      .getClient()
      .from('reports')
      .select('*')
      .neq('status', 'Resolved')
      .order('created_at', { ascending: false });

    // Filter by supervisor_id: either assigned to this supervisor or unassigned (NULL)
    // Note: Supabase doesn't support OR directly, so we'll filter in application logic
    const { data: allReports, error } = await query;

    if (error) {
      throw new BadRequestException('Failed to fetch reports');
    }

    // Filter: supervisor_id matches current supervisor OR supervisor_id is NULL
    const filteredReports =
      (allReports as Report[])?.filter(
        (report) => !report.supervisor_id || report.supervisor_id === user.uid,
      ) || [];

    return filteredReports;
  }
}
