/**
 * Payment use-cases (Owner-QR + slip model). Create a QR, accept a slip upload
 * (dedup by slip_hash), expose status, and apply the saga's fraud decision.
 * Money never moves here — approval emits PaymentApproved; the saga posts the
 * Ledger TOPUP.
 */
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ValidationError, ForbiddenError, NotFoundError } from '@smartwash/common';
import { IdempotencyService } from '@smartwash/nestkit';
import { targetState, type FraudState } from '../domain/decision';
import {
  PAYMENT_REPOSITORY,
  type OcrFields,
  type PayReqType,
  type PaymentRepository,
  type ReviewItem,
  type SlipStatus,
} from '../domain/ports';

export interface CreatePaymentInput {
  type: PayReqType;
  amount: bigint; // kip
  orderId?: string;
}

export interface CreatePaymentResult {
  qrRef: string;
  qrPayload: string;
  amount: bigint;
  expiresAt: string;
}

@Injectable()
export class PaymentService {
  private readonly expiryMin: number;

  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly repo: PaymentRepository,
    private readonly idempotency: IdempotencyService,
  ) {
    this.expiryMin = Number.parseInt(process.env.PAYMENT_EXPIRY_MIN ?? '30', 10);
  }

  async createPayment(
    idempotencyKey: string,
    userId: string,
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    if (input.type === 'order' && !input.orderId) {
      throw new ValidationError('orderId is required when type = order');
    }
    const { result } = await this.idempotency.execute(
      idempotencyKey,
      'payment.create',
      { userId, ...input },
      async () => {
        const qrRef = `QR-${randomUUID()}`;
        const expiresAt = new Date(
          Date.now() + this.expiryMin * 60_000,
        ).toISOString();
        await this.repo.createRequest({
          id: randomUUID(),
          userId,
          type: input.type,
          orderId: input.orderId ?? null,
          qrRef,
          amountExpected: input.amount,
          expiresAt,
        });
        return {
          qrRef,
          qrPayload: this.buildQrPayload(qrRef, input.amount),
          amount: input.amount,
          expiresAt,
        };
      },
    );
    return result;
  }

  async uploadSlip(
    idempotencyKey: string,
    qrRef: string,
    userId: string,
    imageObjectKey: string,
    slipHash: string,
  ): Promise<SlipStatus> {
    const { result } = await this.idempotency.execute(
      idempotencyKey,
      'payment.slip',
      { qrRef, userId, slipHash },
      async () => {
        await this.repo.uploadSlip(qrRef, userId, slipHash, imageObjectKey);
        const status = await this.repo.getStatus(qrRef);
        if (!status) throw new NotFoundError('payment request not found');
        return status;
      },
    );
    return result;
  }

  async getStatus(qrRef: string, callerId: string): Promise<SlipStatus> {
    const req = await this.repo.findByQrRef(qrRef);
    if (!req) throw new NotFoundError('payment request not found');
    if (req.userId !== callerId) {
      throw new ForbiddenError('can only view your own payment');
    }
    const status = await this.repo.getStatus(qrRef);
    return status as SlipStatus;
  }

  /** Staff/owner manual-review queue (payments parked AWAITING_APPROVAL). */
  listPendingReview(branchId: string | null): Promise<ReviewItem[]> {
    return this.repo.listPendingReview(branchId);
  }

  /**
   * The branch a slip's payment belongs to (its order's branch), used to scope
   * who may approve it. NULL = topup (no branch → global/admin only). Throws if
   * the qrRef is unknown.
   */
  async reviewBranch(qrRef: string): Promise<string | null> {
    const r = await this.repo.reviewBranch(qrRef);
    if (!r) throw new NotFoundError('payment request not found');
    return r.branchId;
  }

  // ── internal (saga) ────────────────────────────────────────────────
  recordOcr(qrRef: string, ocr: OcrFields): Promise<void> {
    return this.repo.setOcr(qrRef, ocr);
  }

  async applyDecision(
    qrRef: string,
    fraudState: FraudState,
    reason: string | null,
  ): Promise<SlipStatus> {
    await this.repo.applyDecision(qrRef, targetState(fraudState), fraudState, reason);
    return (await this.repo.getStatus(qrRef)) as SlipStatus;
  }

  async staffDecision(
    qrRef: string,
    decision: 'approve' | 'reject',
  ): Promise<SlipStatus> {
    const fraudState: FraudState = decision === 'approve' ? 'PASS' : 'REJECT';
    const reason = decision === 'reject' ? 'staff_reject' : null;
    await this.repo.applyDecision(
      qrRef,
      decision === 'approve' ? 'APPROVED' : 'REJECTED',
      fraudState,
      reason,
    );
    return (await this.repo.getStatus(qrRef)) as SlipStatus;
  }

  /** Mock EMVCo-ish QR payload (real bank QR integration is out of scope). */
  private buildQrPayload(qrRef: string, amount: bigint): string {
    return `000201${qrRef}5408${amount}5802LA6304MOCK`;
  }
}
