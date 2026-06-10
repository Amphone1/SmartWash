import type { PayReqState } from './payment-fsm';
import type { FraudState } from './decision';

export type PayReqType = 'topup' | 'order';

export interface PaymentRequest {
  id: string;
  userId: string;
  orderId: string | null;
  type: PayReqType;
  qrRef: string;
  amountExpected: number; // kip
  state: PayReqState;
  expiresAt: string;
  createdAt: string;
}

export interface SlipStatus {
  qrRef: string;
  state: PayReqState;
  ocrAmount: number | null;
  ocrConfidence: number | null;
  fraudState: FraudState | null;
}

export interface CreateRequestInput {
  id: string;
  userId: string;
  type: PayReqType;
  orderId: string | null;
  qrRef: string;
  amountExpected: number;
  expiresAt: string;
}

export interface OcrFields {
  amount: number;
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
}
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
