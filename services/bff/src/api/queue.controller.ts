import {
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { QueueClient } from '../infra/external/clients';

@Controller('bff/queues')
@UseGuards(BffAuthGuard, PermissionsGuard)
export class QueueController {
  constructor(private readonly queue: QueueClient) {}

  @Post(':machineId/join')
  @HttpCode(201)
  @RequirePermission('queue.join')
  join(
    @Req() req: AuthedRequest,
    @Param('machineId', new ParseUUIDPipe()) machineId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<unknown> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    return this.queue.join(key, machineId, req.principal!.userId);
  }
}
