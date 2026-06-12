/** Internal read API — the BFF lists a user's own notifications. */
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ForbiddenError } from '@smartwash/common';
import { InternalTokenGuard, USER_ID_HEADER } from '@smartwash/nestkit';
import {
  PgNotificationRepository,
  type NotificationView,
} from '../infra/db/pg-notification.repository';

@Controller('notifications')
@UseGuards(InternalTokenGuard)
export class NotificationController {
  constructor(private readonly repo: PgNotificationRepository) {}

  @Get('users/:userId')
  list(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Headers(USER_ID_HEADER) callerId: string | undefined,
    @Headers('x-caller-role') callerRole: string | undefined,
    @Query('limit') limit?: string,
  ): Promise<NotificationView[]> {
    const privileged = callerRole === 'admin' || callerRole === 'staff';
    if (!privileged && (!callerId || callerId !== userId)) {
      throw new ForbiddenError('can only view your own notifications');
    }
    return this.repo.listForUser(userId, limit ? Number.parseInt(limit, 10) : 20);
  }

  /** Mark all of the caller's own notifications read (naturally idempotent). */
  @Post('users/:userId/read-all')
  @HttpCode(200)
  async markAllRead(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Headers(USER_ID_HEADER) callerId: string | undefined,
  ): Promise<{ updated: number }> {
    if (!callerId || callerId !== userId) {
      throw new ForbiddenError('can only update your own notifications');
    }
    return { updated: await this.repo.markAllRead(userId) };
  }
}
