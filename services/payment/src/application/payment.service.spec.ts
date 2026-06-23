import { randomUUID } from 'node:crypto';
import { PaymentService } from './payment.service';
import type {
  CreateRequestInput,
  OcrFields,
  PaymentRepository,
  PaymentRequest,
  ReviewItem,
  SlipStatus,
} from '../domain/ports';
import type { PayReqState } from '../domain/payment-fsm';
import type { FraudState } from '../domain/decision';
import { ConflictError } from '@smartwash/common';

const USER = '44444444-4444-4444-8444-444444444444';

class FakeRepo implements PaymentRepository {
  reqs = new Map<string, PaymentRequest>();
  hashes = new Set<string>();

  async createRequest(input: CreateRequestInput): Promise<PaymentRequest> {
    const req: PaymentRequest = {
      id: input.id,
      userId: input.userId,
      orderId: input.orderId,
      type: input.type,
      qrRef: input.qrRef,
      amountExpected: input.amountExpected,
      state: 'PENDING',
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.reqs.set(input.qrRef, req);
    return req;
  }
  async findByQrRef(qrRef: string) {
    return this.reqs.get(qrRef) ?? null;
  }
  async uploadSlip(qrRef: string, _userId: string, slipHash: string) {
    const req = this.reqs.get(qrRef)!;
    if (this.hashes.has(slipHash)) throw new ConflictError('duplicate slip');
    this.hashes.add(slipHash);
    req.state = 'SLIP_UPLOADED';
    return { slipId: randomUUID() };
  }
  async setOcr(_qrRef: string, _ocr: OcrFields) {
    /* no-op */
  }
  async applyDecision(
    qrRef: string,
    to: PayReqState,
    _fraud: FraudState,
    _reason: string | null,
  ) {
    const req = this.reqs.get(qrRef)!;
    req.state = to;
    return req;
  }
  async getStatus(qrRef: string): Promise<SlipStatus | null> {
    const req = this.reqs.get(qrRef);
    if (!req) return null;
    return {
      qrRef,
      state: req.state,
      ocrAmount: null,
      ocrConfidence: null,
      fraudState: null,
    };
  }
  async listPendingReview(branchId: string | null): Promise<ReviewItem[]> {
    const items: ReviewItem[] = [];
    for (const req of this.reqs.values()) {
      if (req.state !== 'AWAITING_APPROVAL') continue;
      // The fake has no orders table → treat every parked payment as a topup
      // (branchId null), which is exactly what an admin/global list returns.
      items.push({
        qrRef: req.qrRef,
        type: req.type,
        amountExpected: req.amountExpected,
        userId: req.userId,
        userName: 'Test User',
        branchId: null,
        ocrAmount: null,
        ocrConfidence: null,
        fraudState: null,
        imageObjectKey: null,
        createdAt: req.createdAt,
      });
    }
    return branchId === null ? items : items.filter((i) => i.branchId === branchId);
  }
  async reviewBranch(qrRef: string): Promise<{ branchId: string | null } | null> {
    const req = this.reqs.get(qrRef);
    if (!req) return null;
    return { branchId: null }; // fake: topup-only, no branch
  }
}

class FakeIdem {
  store = new Map<string, unknown>();
  async execute<T>(key: string, _s: string, _p: unknown, op: () => Promise<T>) {
    if (this.store.has(key)) {
      return { result: this.store.get(key) as T, replayed: true };
    }
    const result = await op();
    this.store.set(key, result);
    return { result, replayed: false };
  }
}

function make() {
  const repo = new FakeRepo();
  const svc = new PaymentService(repo, new FakeIdem() as never);
  return { repo, svc };
}

describe('PaymentService', () => {
  it('creates a topup payment with a QR and expiry', async () => {
    const { svc } = make();
    const res = await svc.createPayment(randomUUID(), USER, {
      type: 'topup',
      amount: 20000n,
    });
    expect(res.qrRef).toMatch(/^QR-/);
    expect(res.amount).toBe(20000n);
    expect(res.qrPayload).toContain('20000');
    expect(new Date(res.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('requires orderId when type = order', async () => {
    const { svc } = make();
    await expect(
      svc.createPayment(randomUUID(), USER, { type: 'order', amount: 1000n }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('accepts a slip then rejects a duplicate slip_hash (409)', async () => {
    const { svc } = make();
    const { qrRef } = await svc.createPayment(randomUUID(), USER, {
      type: 'topup',
      amount: 20000n,
    });
    const hash = 'a'.repeat(64);
    const status = await svc.uploadSlip(randomUUID(), qrRef, USER, 'key1', hash);
    expect(status.state).toBe('SLIP_UPLOADED');
    await expect(
      svc.uploadSlip(randomUUID(), qrRef, USER, 'key2', hash),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('applies a PASS decision → APPROVED', async () => {
    const { svc } = make();
    const { qrRef } = await svc.createPayment(randomUUID(), USER, {
      type: 'topup',
      amount: 20000n,
    });
    await svc.uploadSlip(randomUUID(), qrRef, USER, 'key', 'b'.repeat(64));
    const status = await svc.applyDecision(qrRef, 'PASS', null);
    expect(status.state).toBe('APPROVED');
  });

  it('applies a MANUAL_REVIEW decision → AWAITING_APPROVAL, then staff approve', async () => {
    const { svc } = make();
    const { qrRef } = await svc.createPayment(randomUUID(), USER, {
      type: 'topup',
      amount: 20000n,
    });
    await svc.uploadSlip(randomUUID(), qrRef, USER, 'key', 'c'.repeat(64));
    expect((await svc.applyDecision(qrRef, 'MANUAL_REVIEW', null)).state).toBe(
      'AWAITING_APPROVAL',
    );
    expect((await svc.staffDecision(qrRef, 'approve')).state).toBe('APPROVED');
  });

  it('lists parked payments for review and resolves a topup branch as null', async () => {
    const { svc } = make();
    const { qrRef } = await svc.createPayment(randomUUID(), USER, {
      type: 'topup',
      amount: 20000n,
    });
    await svc.uploadSlip(randomUUID(), qrRef, USER, 'key', 'd'.repeat(64));
    await svc.applyDecision(qrRef, 'MANUAL_REVIEW', null);

    const queue = await svc.listPendingReview(null);
    expect(queue.map((i) => i.qrRef)).toContain(qrRef);
    expect(await svc.reviewBranch(qrRef)).toBeNull(); // topup → no branch
  });

  it('reviewBranch throws (404) for an unknown qrRef', async () => {
    const { svc } = make();
    await expect(svc.reviewBranch('QR-nope')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('forbids viewing another user\'s payment', async () => {
    const { svc } = make();
    const { qrRef } = await svc.createPayment(randomUUID(), USER, {
      type: 'topup',
      amount: 20000n,
    });
    await expect(svc.getStatus(qrRef, 'someone-else')).rejects.toMatchObject({
      status: 403,
    });
  });
});
