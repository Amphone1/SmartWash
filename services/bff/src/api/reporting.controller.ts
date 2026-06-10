/**
 * Dashboard read APIs for the owner + admin portals. Read-only KPI aggregations;
 * RBAC at the gateway (report.view), branch-scoped for owners.
 */
import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import { BffAuthGuard } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import {
  ReportingRepository,
  type AdminSummary,
  type OwnerSummary,
  type ReconRun,
} from '../infra/db/reporting.repository';

@Controller('bff')
@UseGuards(BffAuthGuard, PermissionsGuard)
export class ReportingController {
  constructor(private readonly reporting: ReportingRepository) {}

  @Get('owner/summary')
  @RequirePermission('report.view')
  owner(@Query('branchId') branchId?: string): Promise<OwnerSummary> {
    if (!branchId) throw new ValidationError('branchId is required');
    return this.reporting.ownerSummary(branchId);
  }

  @Get('admin/summary')
  @RequirePermission('report.view')
  admin(): Promise<AdminSummary> {
    return this.reporting.adminSummary();
  }

  @Get('admin/reconciliation')
  @RequirePermission('report.view')
  recon(@Query('limit') limit?: string): Promise<ReconRun[]> {
    return this.reporting.reconRuns(limit ? Number.parseInt(limit, 10) : 20);
  }
}
