import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IssueStatus } from './issues-status.enum';
import { MLService } from 'src/ml/ml.service';

@Injectable()
export class IssuesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mlService: MLService,
  ) {}

  async mergeOrCreateIssue(payload: {
    issue_type: string;
    block_id: string;
    image_url: string;
    user_id: string;
  }) {
    const { issue_type, block_id, image_url, user_id } = payload;

    const { data: existing } = await this.supabase
      .getClient()
      .from('issues')
      .select('*')
      .eq('issue_type', issue_type)
      .eq('block_id', block_id)
      .neq('status', IssueStatus.RESOLVED)
      .single();

    if (existing) {
      await this.supabase
        .getClient()
        .from('issues')
        .update({ priority: existing.priority + 1 })
        .eq('id', existing.id);

      await this.supabase.getClient().from('issue_images').insert({
        issue_id: existing.id,
        image_url,
        type: 'REPORTED',
      });

      return { merged: true, issue_id: existing.id };
    }

    const { data: issue } = await this.supabase
      .getClient()
      .from('issues')
      .insert({
        issue_type,
        block_id,
        status: IssueStatus.REPORTED,
        created_by_user_id: user_id,
      })
      .select()
      .single();

    await this.supabase.getClient().from('issue_images').insert({
      issue_id: issue.id,
      image_url,
      type: 'REPORTED',
    });

    return { merged: false, issue_id: issue.id };
  }
  async markInProgress(issueId: string, estimated_time: string) {
    const { data: issue } = await this.supabase
      .getClient()
      .from('reports')
      .update({
        status: IssueStatus.IN_PROGRESS,
        estimated_resolution_time: estimated_time,
      })
      .eq('id', issueId)
      .select()
      .single();

    if (!issue) {
      throw new BadRequestException('Issue not found');
    }

    const { data: supervisor } = await this.supabase
      .getClient()
      .from('users')
      .select('id')
      .eq('block_id', issue.block_id)
      .eq('role', 'SUPERVISOR')
      .single();

    if (!supervisor) {
      throw new BadRequestException('Supervisor not found');
    }

    await this.supabase.getClient().from('issue_assignments').insert({
      issue_id: issueId,
      supervisor_id: supervisor.id,
      assigned_at: new Date(),
    });

    await this.supabase.getClient().from('issue_assignments').insert({
      issue_id: issueId,
      supervisor_id: supervisor.id,
      assigned_at: new Date(),
    });

    await this.supabase
      .getClient()
      .from('issues')
      .update({ status: IssueStatus.ASSIGNED_TO_SUPERVISOR })
      .eq('id', issueId);

    return { success: true };
  }
  async assignWorker(issueId: string, workerName: string, user) {
    if (user.role !== 'SUPERVISOR') throw new Error('Unauthorized');

    await this.supabase
      .getClient()
      .from('issue_assignments')
      .update({ worker_name: workerName })
      .eq('issue_id', issueId)
      .eq('supervisor_id', user.uid);

    await this.supabase
      .getClient()
      .from('issues')
      .update({ status: 'ASSIGNED_TO_WORKER' })
      .eq('id', issueId);

    return { success: true };
  }
  async completeIssue(issueId: string, imageUrl: string, user) {
    if (user.role !== 'SUPERVISOR') throw new Error('Unauthorized');

    // Save completion image
    await this.supabase.getClient().from('issue_images').insert({
      issue_id: issueId,
      image_url: imageUrl,
      type: 'COMPLETED',
    });

    await this.supabase
      .getClient()
      .from('issues')
      .update({ status: 'WORK_COMPLETED' })
      .eq('id', issueId);

    return this.verifyIssue(issueId, imageUrl);
  }
  async verifyIssue(issueId: string, imageUrl: string) {
    const { data: issue } = await this.supabase
      .getClient()
      .from('issues')
      .select('issue_type')
      .eq('id', issueId)
      .single();

    const mlSupportedIssues = [
      'POTHOLE',
      'BROKEN_STREET_LIGHT',
      'GARBAGE_OVERFLOW',
      'DRAINAGE_OVERFLOW',
    ];

    if (!issue) {
      throw new BadRequestException('Issue not found');
    }

    if (!mlSupportedIssues.includes(issue.issue_type)) {
      return this.resolveIssue(issueId);
    }

    const prediction = await this.mlService.verifyImage(imageUrl);

    if (!prediction || prediction.confidence < 0.7) {
      await this.supabase
        .getClient()
        .from('issues')
        .update({ status: 'MANUAL_REVIEW' })
        .eq('id', issueId);

      return { status: 'MANUAL_REVIEW' };
    }

    return this.resolveIssue(issueId, prediction);
  }
  async resolveIssue(issueId: string, mlResult?: any) {
    await this.supabase
      .getClient()
      .from('issues')
      .update({ status: 'RESOLVED' })
      .eq('id', issueId);

    if (mlResult) {
      await this.supabase.getClient().from('ml_verification').insert({
        issue_id: issueId,
        predicted_class: mlResult.predicted_class,
        confidence: mlResult.confidence,
        verified: true,
        verified_at: new Date(),
      });
    }

    return { status: 'RESOLVED' };
  }
}
