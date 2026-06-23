import type { PayReqState } from './payment-fsm';
import type { FraudState } from './decision';

export type PayReqType = 'topup' | 'order';

export interface PaymentRequest {
  id: string;
  userId: string;
  orderId: string | null;
  type: PayReqType;
  qrRef: string;
  amountExpected: bigint; // kip
  state: PayReqState;
  expiresAt: string;
  createdAt: string;
}

export interface SlipStatus {
  qrRef: string;
  state: PayReqState;
  ocrAmount: bigint | null;
  ocrConfidence: number | null;
  fraudState: FraudState | null;
}

/** A payment parked in AWAITING_APPROVAL, for the staff/owner review queue. */
export interface ReviewItem {
  qrRef: string;
  type: PayReqType;
  amountExpected: bigint;
  userId: string;
  userName: string;
  /** The order's branch; NULL for a topup (which has no order/branch). */
  branchId: string | null;
  ocrAmount: bigint | null;
  ocrConfidence: number | null;
  fraudState: FraudState | null;
  imageObjectKey: string | null;
  createdAt: string;
}

export interface CreateRequestInput {
  id: string;
  userId: string;
  type: PayReqType;
  orderId: string | null;
  qrRef: string;
  amountExpected: bigint;
  expiresAt: string;
}

export interface OcrFields {
  amount: bigint;
  ref: string;
  account: string;
  confidence: number;
  json: Record<string, unknown>;
}

export interface PaymentRepository {
  createRequest(input: CreateRequestInput): Promise<PaymentRequest>;
  findByQrRef(qrRef: string): Promise<PaymentRequest | null>;
  /** Insert slip (slip_hash UNIQUE → duplicate), mark SLIP_UPLOADED, emit SlipUploaded. */
  uploadSlip(
    qrRef: string,
    userId: string,
    slipHash: string,
    objectKey: string,
  ): Promise<{ slipId: string }>;
  setOcr(qrRef: string, ocr: OcrFields): Promise<void>;
  /** Guarded transition + slip.fraud_state + PaymentApproved/Rejected outbox. */
  applyDecision(
    qrRef: string,
    to: PayReqState,
    fraudState: FraudState,
    reason: string | null,
  ): Promise<PaymentRequest>;
  getStatus(qrRef: string): Promise<SlipStatus | null>;
  /** Payments parked in AWAITING_APPROVAL; branch null = all branches (admin). */
  listPendingReview(branchId: string | null): Promise<ReviewItem[]>;
  /**
   * The branch a slip belongs to (its order's branch), for approval scoping.
   * Returns null branchId for a topup (no order). `null` = qrRef not found.
   */
  reviewBranch(qrRef: string): Promise<{ branchId: string | null } | null>;
}
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
