import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendReportStatusNotification(payload: {
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'resolved';
    user_id: string;
  }) {
    try {
      await axios.post(
        `${process.env.NOTIFICATION_SERVICE_URL}/notifications/report-status`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `Notification sent for report ${payload.id} to user ${payload.user_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send notification for report ${payload.id}`,
        error?.message,
      );
      // ❗ Do NOT throw — notification failure should not break main flow
    }
  }
}
