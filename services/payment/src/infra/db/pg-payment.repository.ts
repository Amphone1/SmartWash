/**
 * Postgres adapter for Payment. Writes go through transactions so a state change
 * and its outbox event commit together (rule #4). slip_hash UNIQUE is the hard
 * fraud-dedup guard (rule #9) — a duplicate insert surfaces as 23505 → 409.
 */
import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
} from '@smartwash/common';
import { Database, insertOutbox } from '@smartwash/nestkit';
import type { PayReqState } from '../../domain/payment-fsm';
import { canTransition } from '../../domain/payment-fsm';
import type { FraudState } from '../../domain/decision';
import type {
  CreateRequestInput,
  OcrFields,
  PaymentRepository,
  PaymentRequest,
  ReviewItem,
  SlipStatus,
} from '../../domain/ports';

interface ReqRow {
  id: string;
  user_id: string;
  order_id: string | null;
  type: string;
  qr_ref: string;
  amount_expected: string;
  state: string;
  expires_at: Date;
  created_at: Date;
}

function toReq(r: ReqRow): PaymentRequest {
  return {
    id: r.id,
    userId: r.user_id,
    orderId: r.order_id,
    type: r.type as PaymentRequest['type'],
    qrRef: r.qr_ref,
    amountExpected: BigInt(r.amount_expected),
    state: r.state as PayReqState,
    expiresAt: r.expires_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

const FRAUD_FOR_STATE: Record<string, FraudState> = {
  APPROVED: 'PASS',
  REJECTED: 'REJECT',
  AWAITING_APPROVAL: 'MANUAL_REVIEW',
};

@Injectable()
export class PgPaymentRepository implements PaymentRepository {
  constructor(private readonly db: Database) {}

  async createRequest(input: CreateRequestInput): Promise<PaymentRequest> {
    const { rows } = await this.db.getPool().query<ReqRow>(
      `INSERT INTO payment_requests
         (id, user_id, order_id, type, qr_ref, amount_expected, state, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7) RETURNING *`,
      [
        input.id,
        input.userId,
        input.orderId,
        input.type,
        input.qrRef,
        input.amountExpected.toString(),
        input.expiresAt,
      ],
    );
    return toReq(rows[0]);
  }

  async findByQrRef(qrRef: string): Promise<PaymentRequest | null> {
    const { rows } = await this.db
      .getPool()
      .query<ReqRow>(`SELECT * FROM payment_requests WHERE qr_ref = $1`, [qrRef]);
    return rows[0] ? toReq(rows[0]) : null;
  }

  async uploadSlip(
    qrRef: string,
    userId: string,
    slipHash: string,
    objectKey: string,
  ): Promise<{ slipId: string }> {
    return this.db.withTransaction(async (client) => {
      const reqRes = await client.query<ReqRow>(
        `SELECT * FROM payment_requests WHERE qr_ref = $1 FOR UPDATE`,
        [qrRef],
      );
      const req = reqRes.rows[0];
      if (!req) throw new NotFoundError('payment request not found');
      if (req.user_id !== userId) {
        throw new ConflictError('slip user does not match payment request');
      }
      if (!canTransition(req.state as PayReqState, 'SLIP_UPLOADED')) {
        throw new ConflictError(`cannot upload slip in state ${req.state}`);
      }

      let slipId: string;
      try {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO slips (payment_request_id, user_id, slip_hash, image_object_key)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [req.id, userId, slipHash, objectKey],
        );
        slipId = ins.rows[0].id;
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          throw new ConflictError('duplicate slip'); // slip_hash already seen
        }
        throw err;
      }

      await client.query(
        `UPDATE payment_requests SET state = 'SLIP_UPLOADED' WHERE id = $1`,
        [req.id],
      );
      await insertOutbox(client, {
        aggregateType: 'payment',
        aggregateId: req.id,
        eventType: 'smartwash.payment.slip_uploaded.v1',
        payload: {
          qrRef,
          slipId,
          userId,
          slipHash,
          // Enrichment for the topup saga (event schema allows extra fields):
          imageObjectKey: objectKey,
          amountExpected: Number(req.amount_expected),
        },
      });
      return { slipId };
    });
  }

  async setOcr(qrRef: string, ocr: OcrFields): Promise<void> {
    const res = await this.db.getPool().query(
      `UPDATE slips s
          SET ocr_amount = $2, ocr_ref = $3, ocr_account = $4,
              ocr_confidence = $5, ocr_json = $6
         FROM payment_requests pr
        WHERE s.payment_request_id = pr.id AND pr.qr_ref = $1`,
      [
        qrRef,
        ocr.amount.toString(),
        ocr.ref,
        ocr.account,
        ocr.confidence,
        JSON.stringify(ocr.json),
      ],
    );
    if (res.rowCount === 0) throw new NotFoundError('slip not found for qrRef');
  }

  async applyDecision(
    qrRef: string,
    to: PayReqState,
    fraudState: FraudState,
    reason: string | null,
  ): Promise<PaymentRequest> {
    return this.db.withTransaction(async (client) => {
      const reqRes = await client.query<ReqRow>(
        `SELECT * FROM payment_requests WHERE qr_ref = $1 FOR UPDATE`,
        [qrRef],
      );
      const req = reqRes.rows[0];
      if (!req) throw new NotFoundError('payment request not found');
      if (!canTransition(req.state as PayReqState, to)) {
        throw new ConflictError(`cannot move ${req.state} → ${to}`);
      }

      const updated = await client.query<ReqRow>(
        `UPDATE payment_requests SET state = $2 WHERE id = $1 RETURNING *`,
        [req.id, to],
      );
      await client.query(
        `UPDATE slips SET fraud_state = $2
          WHERE payment_request_id = $1`,
        [req.id, FRAUD_FOR_STATE[to] ?? fraudState],
      );

      if (to === 'APPROVED') {
        await insertOutbox(client, {
          aggregateType: 'payment',
          aggregateId: req.id,
          eventType: 'smartwash.payment.approved.v1',
          payload: {
            qrRef,
            userId: req.user_id,
            amount: Number(req.amount_expected),
            purpose: req.type,
            orderId: req.order_id ?? undefined,
          },
        });
      } else if (to === 'REJECTED') {
        await insertOutbox(client, {
          aggregateType: 'payment',
          aggregateId: req.id,
          eventType: 'smartwash.payment.rejected.v1',
          payload: { qrRef, userId: req.user_id, reason: reason ?? 'staff_reject' },
        });
      }

      return toReq(updated.rows[0]);
    });
  }

  async getStatus(qrRef: string): Promise<SlipStatus | null> {
    const { rows } = await this.db.getPool().query(
      `SELECT pr.qr_ref, pr.state,
              s.ocr_amount, s.ocr_confidence, s.fraud_state
         FROM payment_requests pr
         LEFT JOIN slips s ON s.payment_request_id = pr.id
        WHERE pr.qr_ref = $1
        ORDER BY s.created_at DESC NULLS LAST
        LIMIT 1`,
      [qrRef],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      qrRef: r.qr_ref,
      state: r.state,
      ocrAmount: r.ocr_amount !== null ? BigInt(r.ocr_amount) : null,
      ocrConfidence: r.ocr_confidence !== null ? Number(r.ocr_confidence) : null,
      fraudState: r.fraud_state ?? null,
    };
  }

  async listPendingReview(branchId: string | null): Promise<ReviewItem[]> {
    // The manual-review queue: payments parked AWAITING_APPROVAL. A topup has no
    // order, so o.branch_id is NULL and the row is only visible to a global
    // (admin) caller (branchId param null); a branch-scoped caller passes their
    // branch and sees only that branch's order-payment slips.
    const { rows } = await this.db.getPool().query(
      `SELECT pr.qr_ref, pr.type, pr.amount_expected, pr.user_id, pr.created_at,
              u.name AS user_name, o.branch_id,
              s.image_object_key, s.ocr_amount, s.ocr_confidence, s.fraud_state
         FROM payment_requests pr
         JOIN users u ON u.id = pr.user_id
         LEFT JOIN orders o ON o.id = pr.order_id
         LEFT JOIN LATERAL (
           SELECT image_object_key, ocr_amount, ocr_confidence, fraud_state
             FROM slips WHERE payment_request_id = pr.id
            ORDER BY created_at DESC LIMIT 1
         ) s ON true
        WHERE pr.state = 'AWAITING_APPROVAL'
          AND ($1::uuid IS NULL OR o.branch_id = $1)
        ORDER BY pr.created_at ASC
        LIMIT 200`,
      [branchId],
    );
    return rows.map((r) => ({
      qrRef: r.qr_ref,
      type: r.type,
      amountExpected: BigInt(r.amount_expected),
      userId: r.user_id,
      userName: r.user_name,
      branchId: r.branch_id ?? null,
      ocrAmount: r.ocr_amount !== null ? BigInt(r.ocr_amount) : null,
      ocrConfidence: r.ocr_confidence !== null ? Number(r.ocr_confidence) : null,
      fraudState: r.fraud_state ?? null,
      imageObjectKey: r.image_object_key ?? null,
      createdAt:
        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  async reviewBranch(
    qrRef: string,
  ): Promise<{ branchId: string | null } | null> {
    const { rows } = await this.db.getPool().query<{ branch_id: string | null }>(
      `SELECT o.branch_id
         FROM payment_requests pr
         LEFT JOIN orders o ON o.id = pr.order_id
        WHERE pr.qr_ref = $1`,
      [qrRef],
    );
    if (rows.length === 0) return null;
    return { branchId: rows[0].branch_id ?? null };
  }
}
