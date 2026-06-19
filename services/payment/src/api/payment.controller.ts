/**
 * Payment API (contracts/openapi/payment.yaml + internal saga endpoints).
 * User-facing routes: InternalTokenGuard (behind BFF) + independent RBAC re-check
 * (rule #8); userId is taken from the forwarded X-User-Id, never the body.
 * Internal routes (/internal/...): InternalTokenGuard only (saga), except the
 * staff manual-review which also RBAC-checks slip.approve.
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
  UseGuards,
} from '@nestjs/common';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '@smartwash/common';
import {
  InternalTokenGuard,
  RbacClient,
  RbacGuard,
  RequirePermission,
  USER_ID_HEADER,
} from '@smartwash/nestkit';
import {
  PaymentService,
  type CreatePaymentResult,
} from '../application/payment.service';
import {
  CreatePaymentDto,
  DecisionDto,
  OcrDto,
  StaffDecisionDto,
  UploadSlipDto,
} from './dto';
import type { ReviewItem, SlipStatus } from '../domain/ports';

type CreatePaymentJson = Omit<CreatePaymentResult, 'amount'> & { amount: number };
type SlipStatusJson = Omit<SlipStatus, 'ocrAmount'> & { ocrAmount: number | null };
type ReviewItemJson = Omit<ReviewItem, 'amountExpected' | 'ocrAmount'> & {
  amountExpected: number;
  ocrAmount: number | null;
};

function toPaymentJson(r: CreatePaymentResult): CreatePaymentJson {
  return { ...r, amount: Number(r.amount) };
}
function toSlipJson(s: SlipStatus): SlipStatusJson {
  return { ...s, ocrAmount: s.ocrAmount !== null ? Number(s.ocrAmount) : null };
}
function toReviewJson(r: ReviewItem): ReviewItemJson {
  return {
    ...r,
    amountExpected: Number(r.amountExpected),
    ocrAmount: r.ocrAmount !== null ? Number(r.ocrAmount) : null,
  };
}

function requireUser(id: string | undefined): string {
  if (!id) throw new UnauthorizedError('missing user identity');
  return id;
}
function requireKey(key: string | undefined): string {
  if (!key) throw new ValidationError('Idempotency-Key header is required');
  return key;
}

@Controller()
export class PaymentController {
  constructor(
    private readonly payment: PaymentService,
    private readonly rbac: RbacClient,
  ) {}

  // ── user-facing (behind BFF) ───────────────────────────────────────
  @Post('payments')
  @HttpCode(201)
  @UseGuards(InternalTokenGuard, RbacGuard)
  @RequirePermission('payment.create')
  async create(
    @Headers(USER_ID_HEADER) userId: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CreatePaymentDto,
  ): Promise<CreatePaymentJson> {
    const result = await this.payment.createPayment(requireKey(key), requireUser(userId), {
      type: body.type,
      amount: BigInt(body.amount),
      orderId: body.orderId,
    });
    return toPaymentJson(result);
  }

  @Post('payments/:qrRef/slip')
  @HttpCode(202)
  @UseGuards(InternalTokenGuard, RbacGuard)
  @RequirePermission('payment.create')
  async uploadSlip(
    @Param('qrRef') qrRef: string,
    @Headers(USER_ID_HEADER) userId: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: UploadSlipDto,
  ): Promise<SlipStatusJson> {
    const status = await this.payment.uploadSlip(
      requireKey(key),
      qrRef,
      requireUser(userId),
      body.imageObjectKey,
      body.slipHash,
    );
    return toSlipJson(status);
  }

  @Get('payments/:qrRef')
  @UseGuards(InternalTokenGuard)
  async status(
    @Param('qrRef') qrRef: string,
    @Headers(USER_ID_HEADER) userId: string | undefined,
  ): Promise<SlipStatusJson> {
    return toSlipJson(await this.payment.getStatus(qrRef, requireUser(userId)));
  }

  // ── internal (saga) ────────────────────────────────────────────────
  @Post('internal/payments/:qrRef/ocr')
  @HttpCode(200)
  @UseGuards(InternalTokenGuard)
  ocr(@Param('qrRef') qrRef: string, @Body() body: OcrDto): Promise<void> {
    return this.payment.recordOcr(qrRef, {
      amount: BigInt(body.amount),
      ref: body.ref,
      account: body.account,
      confidence: body.confidence,
      json: body.json ?? {},
    });
  }

  @Post('internal/payments/:qrRef/decision')
  @HttpCode(200)
  @UseGuards(InternalTokenGuard)
  async decision(
    @Param('qrRef') qrRef: string,
    @Body() body: DecisionDto,
  ): Promise<SlipStatusJson> {
    return toSlipJson(await this.payment.applyDecision(qrRef, body.state, body.reason ?? null));
  }

  // ── staff/owner manual review (behind BFF) ─────────────────────────
  /**
   * Review queue: payments parked AWAITING_APPROVAL. Branch comes from the
   * query (the BFF supplies the caller's branch); RbacGuard verifies the caller
   * holds slip.approve in that branch — so a branch-scoped owner only ever lists
   * their own branch, and only a global admin (no branchId) lists topups.
   */
  @Get('internal/slips')
  @UseGuards(InternalTokenGuard, RbacGuard)
  @RequirePermission('slip.approve')
  async listReview(
    @Query('branchId') branchId?: string,
  ): Promise<ReviewItemJson[]> {
    const items = await this.payment.listPendingReview(branchId ?? null);
    return items.map(toReviewJson);
  }

  @Post('internal/payments/:qrRef/staff-decision')
  @HttpCode(200)
  @UseGuards(InternalTokenGuard)
  async staffDecision(
    @Param('qrRef') qrRef: string,
    @Headers(USER_ID_HEADER) userId: string | undefined,
    @Body() body: StaffDecisionDto,
  ): Promise<SlipStatusJson> {
    const actor = requireUser(userId);
    // Branch-aware approval (authoritative re-check, rule #8): the actor must
    // hold slip.approve in the SLIP's branch — derived from the slip, never the
    // caller. Order slips → the order's branch; topup slips have no branch, so
    // only a GLOBAL grant (admin) can approve them. Blocks cross-branch approval.
    const branchId = await this.payment.reviewBranch(qrRef);
    if (!(await this.rbac.check(actor, 'slip.approve', branchId))) {
      throw new ForbiddenError('missing permission slip.approve');
    }
    return toSlipJson(await this.payment.staffDecision(qrRef, body.decision));
  }
}
