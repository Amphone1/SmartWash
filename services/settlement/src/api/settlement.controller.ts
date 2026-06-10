/**
 * Settlement API (internal, behind BFF). Reads RBAC settlement.view; run/pay/
 * close require staff.payout. Record-only — payout is an external bank transfer
 * tracked by settlement_lines.paid.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import {
  InternalTokenGuard,
  RbacGuard,
  RequirePermission,
} from '@smartwash/nestkit';
import { SettlementService } from '../application/settlement.service';
import { RunSettlementDto } from './dto';
import type { SettlementView } from '../domain/ports';

@Controller()
@UseGuards(InternalTokenGuard, RbacGuard)
export class SettlementController {
  constructor(private readonly settlement: SettlementService) {}

  @Post('internal/settlements/run')
  @HttpCode(200)
  @RequirePermission('staff.payout')
  run(@Body() body: RunSettlementDto): Promise<SettlementView> {
    return this.settlement.run(body.branchId, body.date);
  }

  @Get('settlements')
  @RequirePermission('settlement.view')
  list(@Query('branchId') branchId?: string): Promise<SettlementView[]> {
    if (!branchId) throw new ValidationError('branchId is required');
    return this.settlement.list(branchId);
  }

  @Post('internal/settlement-lines/:id/pay')
  @HttpCode(200)
  @RequirePermission('staff.payout')
  async pay(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ ok: boolean }> {
    await this.settlement.markPaid(id);
    return { ok: true };
  }

  @Post('internal/settlements/:id/close')
  @HttpCode(200)
  @RequirePermission('staff.payout')
  async close(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ ok: boolean }> {
    await this.settlement.close(id);
    return { ok: true };
  }
}
