/**
 * Staff-facing BFF endpoints. Staff are branch-scoped: branchId is read from
 * the JWT (user_roles row), never from the request — so each action checks its
 * permission explicitly at the staff's own branch (assertBranchPermission)
 * rather than via the request-branch PermissionsGuard, which would see no
 * branch context here and deny.
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ForbiddenError, ValidationError } from '@smartwash/common';
import { RateLimit, RateLimitGuard } from '@smartwash/nestkit';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RejectSlipBffDto } from './dto';
import { PaymentClient, RbacClient } from '../infra/external/clients';
import { ReportingRepository } from '../infra/db/reporting.repository';

@Controller('bff/staff')
@UseGuards(BffAuthGuard, PermissionsGuard, RateLimitGuard)
export class StaffController {
  constructor(
    private readonly reporting: ReportingRepository,
    private readonly payments: PaymentClient,
    private readonly rbac: RbacClient,
  ) {}

  private branchFromJwt(req: AuthedRequest): string {
    const branchId = req.principal?.roles.find((r) => r.branchId != null)?.branchId;
    if (!branchId) throw new ValidationError('no branch assigned to this staff account');
    return branchId;
  }

  /**
   * Branch-scoped gate. Staff branch comes from the JWT (never the request), so
   * the generic PermissionsGuard — which reads branchId from the request — would
   * see a null context and deny. Check the permission explicitly at the staff's
   * own branch. Money-touching actions (slip approve) are additionally
   * re-checked against the target's real branch downstream (rule #8).
   */
  private async assertBranchPermission(
    req: AuthedRequest,
    permission: string,
  ): Promise<void> {
    const ok = await this.rbac.check(
      req.principal!.userId,
      permission,
      this.branchFromJwt(req),
    );
    if (!ok) throw new ForbiddenError(`missing permission ${permission}`);
  }

  /** Real-time machine state list for the staff's branch. */
  @Get('machines')
  async machines(@Req() req: AuthedRequest) {
    await this.assertBranchPermission(req, 'order.view.branch');
    return this.reporting.ownerMachines(this.branchFromJwt(req));
  }

  /** Order queue for the staff's branch (last 200, newest first). */
  @Get('orders')
  async orders(
    @Req() req: AuthedRequest,
    @Query('status') status?: string,
  ) {
    await this.assertBranchPermission(req, 'order.view.branch');
    return this.reporting.ownerOrders(this.branchFromJwt(req), status);
  }

  /** Slip verification queue — pending slips for the staff's branch. */
  @Get('slips')
  async slips(
    @Req() req: AuthedRequest,
    @Query('status') status?: string,
  ): Promise<unknown> {
    await this.assertBranchPermission(req, 'slip.approve');
    return this.payments.listSlips(req.principal!.userId, this.branchFromJwt(req), status);
  }

  @Post('slips/:qrRef/approve')
  @HttpCode(200)
  @RateLimit(30, 60, 'user')
  async approveSlip(
    @Req() req: AuthedRequest,
    @Param('qrRef') qrRef: string,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<unknown> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    await this.assertBranchPermission(req, 'slip.approve');
    return this.payments.approveSlip(key, req.principal!.userId, qrRef);
  }

  @Post('slips/:qrRef/reject')
  @HttpCode(200)
  @RateLimit(30, 60, 'user')
  async rejectSlip(
    @Req() req: AuthedRequest,
    @Param('qrRef') qrRef: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: RejectSlipBffDto,
  ): Promise<unknown> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    await this.assertBranchPermission(req, 'slip.approve');
    return this.payments.rejectSlip(key, req.principal!.userId, qrRef, body.reason);
  }
}
