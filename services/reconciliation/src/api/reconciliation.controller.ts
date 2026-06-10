/**
 * Reconciliation API (internal, behind BFF). RBAC report.view (owner/admin).
 * Read-only over the ledger — classifies bank lines and flags unbacked TOPUPs.
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
import { ReconciliationService } from '../application/reconciliation.service';
import { RunReconDto } from './dto';
import type { PersistLine, ReconRunView } from '../domain/ports';

@Controller()
@UseGuards(InternalTokenGuard, RbacGuard)
export class ReconciliationController {
  constructor(private readonly recon: ReconciliationService) {}

  @Post('internal/reconciliation/run')
  @HttpCode(200)
  @RequirePermission('report.view')
  run(@Body() body: RunReconDto): Promise<ReconRunView> {
    return this.recon.run(body.branchId, body.date, body.statementLines);
  }

  @Get('reconciliation/runs')
  @RequirePermission('report.view')
  runs(@Query('branchId') branchId?: string): Promise<ReconRunView[]> {
    if (!branchId) throw new ValidationError('branchId is required');
    return this.recon.listRuns(branchId);
  }

  @Get('reconciliation/runs/:id/lines')
  @RequirePermission('report.view')
  lines(@Param('id', new ParseUUIDPipe()) id: string): Promise<PersistLine[]> {
    return this.recon.listLines(id);
  }
}
