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
  UseGuards,
} from '@nestjs/common';
import { UnauthorizedError, ValidationError } from '@smartwash/common';
import {
  InternalTokenGuard,
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
import type { SlipStatus } from '../domain/ports';

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
  constructor(private readonly payment: PaymentService) {}

  // ── user-facing (behind BFF) ───────────────────────────────────────
  @Post('payments')
  @HttpCode(201)
  @UseGuards(InternalTokenGuard, RbacGuard)
  @RequirePermission('payment.create')
  create(
    @Headers(USER_ID_HEADER) userId: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CreatePaymentDto,
  ): Promise<CreatePaymentResult> {
    return this.payment.createPayment(requireKey(key), requireUser(userId), body);
  }

  @Post('payments/:qrRef/slip')
  @HttpCode(202)
  @UseGuards(InternalTokenGuard, RbacGuard)
  @RequirePermission('payment.create')
  uploadSlip(
    @Param('qrRef') qrRef: string,
    @Headers(USER_ID_HEADER) userId: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: UploadSlipDto,
  ): Promise<SlipStatus> {
    return this.payment.uploadSlip(
      requireKey(key),
      qrRef,
      requireUser(userId),
      body.imageObjectKey,
      body.slipHash,
    );
  }

  @Get('payments/:qrRef')
  @UseGuards(InternalTokenGuard)
  status(
    @Param('qrRef') qrRef: string,
    @Headers(USER_ID_HEADER) userId: string | undefined,
  ): Promise<SlipStatus> {
    return this.payment.getStatus(qrRef, requireUser(userId));
  }

  // ── internal (saga) ────────────────────────────────────────────────
  @Post('internal/payments/:qrRef/ocr')
  @HttpCode(200)
  @UseGuards(InternalTokenGuard)
  ocr(@Param('qrRef') qrRef: string, @Body() body: OcrDto): Promise<void> {
    return this.payment.recordOcr(qrRef, {
      amount: body.amount,
      ref: body.ref,
      account: body.account,
      confidence: body.confidence,
      json: body.json ?? {},
    });
  }

  @Post('internal/payments/:qrRef/decision')
  @HttpCode(200)
  @UseGuards(InternalTokenGuard)
  decision(
    @Param('qrRef') qrRef: string,
    @Body() body: DecisionDto,
  ): Promise<SlipStatus> {
    return this.payment.applyDecision(qrRef, body.state, body.reason ?? null);
  }

  @Post('internal/payments/:qrRef/staff-decision')
  @HttpCode(200)
  @UseGuards(InternalTokenGuard, RbacGuard)
  @RequirePermission('slip.approve')
  staffDecision(
    @Param('qrRef') qrRef: string,
    @Body() body: StaffDecisionDto,
  ): Promise<SlipStatus> {
    return this.payment.staffDecision(qrRef, body.decision);
  }
}
