/**
 * Dashboard read APIs + finance actions for the owner + admin portals. Reads are
 * KPI aggregations; the run actions proxy to the settlement/reconciliation
 * services (which re-check RBAC). RBAC at the gateway; branch-scoped for owners.
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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { RejectSlipBffDto, RunReconBffDto, RunSettlementBffDto } from './dto';
import {
  ReportingRepository,
  type AdminSummary,
  type OwnerSummary,
  type ReconRun,
} from '../infra/db/reporting.repository';
import {
  AuditClient,
  PaymentClient,
  ReconciliationClient,
  SettlementClient,
} from '../infra/external/clients';

@Controller('bff')
@UseGuards(BffAuthGuard, PermissionsGuard)
export class ReportingController {
  constructor(
    private readonly reporting: ReportingRepository,
    private readonly settlements: SettlementClient,
    private readonly recon: ReconciliationClient,
    private readonly audit: AuditClient,
    private readonly payments: PaymentClient,
  ) {}

  private branchFromJwt(req: AuthedRequest): string | undefined {
    const roles = req.principal?.roles ?? [];
    return roles.find((r) => r.branchId != null)?.branchId ?? undefined;
  }

  @Get('owner/summary')
  @RequirePermission('report.view')
  owner(
    @Req() req: AuthedRequest,
    @Query('branchId') branchId?: string,
  ): Promise<OwnerSummary> {
    const bid = branchId ?? this.branchFromJwt(req);
    if (!bid) throw new ValidationError('branchId is required');
    return this.reporting.ownerSummary(bid);
  }

  @Get('owner/machines')
  @RequirePermission('report.view')
  ownerMachines(
    @Req() req: AuthedRequest,
    @Query('branchId') branchId?: string,
  ) {
    const bid = branchId ?? this.branchFromJwt(req);
    if (!bid) throw new ValidationError('branchId is required');
    return this.reporting.ownerMachines(bid);
  }

  @Get('owner/orders')
  @RequirePermission('report.view')
  ownerOrders(
    @Req() req: AuthedRequest,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    const bid = branchId ?? this.branchFromJwt(req);
    if (!bid) throw new ValidationError('branchId is required');
    return this.reporting.ownerOrders(bid, status);
  }

  @Get('owner/slips')
  @RequirePermission('report.view')
  ownerSlips(
    @Req() req: AuthedRequest,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    const bid = branchId ?? this.branchFromJwt(req);
    if (!bid) throw new ValidationError('branchId is required');
    return this.payments.listSlips(req.principal!.userId, bid, status);
  }

  @Post('owner/slips/:slipId/approve')
  @HttpCode(200)
  @RequirePermission('payment.approve')
  approveSlip(
    @Req() req: AuthedRequest,
    @Param('slipId', new ParseUUIDPipe()) slipId: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<unknown> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    return this.payments.approveSlip(key, req.principal!.userId, slipId);
  }

  @Post('owner/slips/:slipId/reject')
  @HttpCode(200)
  @RequirePermission('payment.approve')
  rejectSlip(
    @Req() req: AuthedRequest,
    @Param('slipId', new ParseUUIDPipe()) slipId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: RejectSlipBffDto,
  ): Promise<unknown> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    return this.payments.rejectSlip(key, req.principal!.userId, slipId, body.reason);
  }

  @Get('owner/stats/hourly')
  @RequirePermission('report.view')
  ownerHourly(
    @Req() req: AuthedRequest,
    @Query('branchId') branchId?: string,
  ) {
    const bid = branchId ?? this.branchFromJwt(req);
    if (!bid) throw new ValidationError('branchId is required');
    return this.reporting.ownerHourlyStats(bid);
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

  @Get('admin/audit')
  @RequirePermission('report.view')
  auditTrail(
    @Req() req: AuthedRequest,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.audit.list(
      req.principal!.userId,
      entityId,
      limit ? Number.parseInt(limit, 10) : undefined,
    );
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
