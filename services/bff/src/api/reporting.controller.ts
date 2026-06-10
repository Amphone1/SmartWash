/**
 * Dashboard read APIs + finance actions for the owner + admin portals. Reads are
 * KPI aggregations; the run actions proxy to the settlement/reconciliation
 * services (which re-check RBAC). RBAC at the gateway; branch-scoped for owners.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { RunReconBffDto, RunSettlementBffDto } from './dto';
import {
  ReportingRepository,
  type AdminSummary,
  type OwnerSummary,
  type ReconRun,
} from '../infra/db/reporting.repository';
import { ReconciliationClient, SettlementClient } from '../infra/external/clients';

@Controller('bff')
@UseGuards(BffAuthGuard, PermissionsGuard)
export class ReportingController {
  constructor(
    private readonly reporting: ReportingRepository,
    private readonly settlements: SettlementClient,
    private readonly recon: ReconciliationClient,
  ) {}

  @Get('owner/summary')
  @RequirePermission('report.view')
  owner(@Query('branchId') branchId?: string): Promise<OwnerSummary> {
    if (!branchId) throw new ValidationError('branchId is required');
    return this.reporting.ownerSummary(branchId);
  }

  @Get('owner/settlements')
  @RequirePermission('settlement.view')
  ownerSettlements(
    @Req() req: AuthedRequest,
    @Query('branchId') branchId?: string,
  ): Promise<unknown> {
    if (!branchId) throw new ValidationError('branchId is required');
    return this.settlements.list(req.principal!.userId, branchId);
  }

  @Post('admin/settlements/run')
  @HttpCode(200)
  @RequirePermission('staff.payout')
  runSettlement(
    @Req() req: AuthedRequest,
    @Body() body: RunSettlementBffDto,
  ): Promise<unknown> {
    return this.settlements.run(req.principal!.userId, body.branchId, body.date);
  }

  @Get('admin/summary')
  @RequirePermission('report.view')
  admin(): Promise<AdminSummary> {
    return this.reporting.adminSummary();
  }

  @Get('admin/reconciliation')
  @RequirePermission('report.view')
  reconRuns(@Query('limit') limit?: string): Promise<ReconRun[]> {
    return this.reporting.reconRuns(limit ? Number.parseInt(limit, 10) : 20);
  }

  @Post('admin/reconciliation/run')
  @HttpCode(200)
  @RequirePermission('report.view')
  runRecon(
    @Req() req: AuthedRequest,
    @Body() body: RunReconBffDto,
  ): Promise<unknown> {
    return this.recon.run(req.principal!.userId, body);
  }
}
