/**
 * Queue API (internal-only behind the gateway/BFF). State-changing POSTs require
 * an Idempotency-Key (rule #3).
 */
import {
  Body,
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
import { ValidationError } from '@smartwash/common';
import { InternalTokenGuard } from '@smartwash/nestkit';
import { QueueService, type PositionView } from '../application/queue.service';
import { JoinQueueDto } from './dto';
import type { QueueEntry } from '../domain/ports';

@Controller('queues')
@UseGuards(InternalTokenGuard)
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Post(':machineId/join')
  @HttpCode(201)
  join(
    @Param('machineId', new ParseUUIDPipe()) machineId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: JoinQueueDto,
  ): Promise<QueueEntry> {
    return this.queue.join(requireKey(key), machineId, body.userId);
  }

  @Get(':machineId')
  list(
    @Param('machineId', new ParseUUIDPipe()) machineId: string,
  ): Promise<QueueEntry[]> {
    return this.queue.list(machineId);
  }

  @Get(':machineId/position')
  position(
    @Param('machineId', new ParseUUIDPipe()) machineId: string,
    @Query('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<PositionView> {
    return this.queue.position(machineId, userId);
  }

  @Post(':machineId/call-next')
  @HttpCode(200)
  callNext(
    @Param('machineId', new ParseUUIDPipe()) machineId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<{ called: QueueEntry | null }> {
    return this.queue
      .callNext(requireKey(key), machineId)
      .then((called) => ({ called }));
  }

  @Post('entries/:id/leave')
  @HttpCode(200)
  leave(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<QueueEntry> {
    return this.queue.leave(requireKey(key), id);
  }
}

function requireKey(key: string | undefined): string {
  if (!key) throw new ValidationError('Idempotency-Key header is required');
  return key;
}
