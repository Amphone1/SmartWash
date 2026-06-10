/**
 * Machine API.
 *   Reads (behind BFF): GET status snapshots.
 *   Internal (saga, InternalTokenGuard): reserve / start / stop / release — these
 *   drive the device over MQTT and the snapshot, never order/payment state.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalTokenGuard } from '@smartwash/nestkit';
import { MachineService } from '../application/machine.service';
import { ReserveDto, StartDto, StopDto } from './dto';
import type { MachineStatusView } from '../domain/ports';

@Controller()
@UseGuards(InternalTokenGuard)
export class MachineController {
  constructor(private readonly machine: MachineService) {}

  @Get('machines/:id/status')
  status(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MachineStatusView> {
    return this.machine.getStatus(id);
  }

  @Get('branches/:branchId/machines/status')
  byBranch(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
  ): Promise<MachineStatusView[]> {
    return this.machine.listByBranch(branchId);
  }

  @Post('internal/machines/:id/reserve')
  @HttpCode(200)
  reserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReserveDto,
  ): Promise<MachineStatusView> {
    return this.machine.reserve(id, body.orderId);
  }

  @Post('internal/machines/:id/start')
  @HttpCode(200)
  start(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StartDto,
  ): Promise<MachineStatusView> {
    return this.machine.start(id, body.orderId, body.cycle);
  }

  @Post('internal/machines/:id/stop')
  @HttpCode(200)
  async stop(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: StopDto,
  ): Promise<{ ok: boolean }> {
    await this.machine.stop(id, body.orderId);
    return { ok: true };
  }

  @Post('internal/machines/:id/release')
  @HttpCode(200)
  release(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MachineStatusView> {
    return this.machine.release(id);
  }
}
