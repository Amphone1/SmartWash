/**
 * Order ratings use-case. Customers rate their OWN COMPLETED orders once
 * (UNIQUE order_id+user_id); idempotent per Idempotency-Key (rule #3).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@smartwash/common';
import { IdempotencyService } from '@smartwash/nestkit';
import { ORDER_REPOSITORY, type OrderRepository } from '../domain/ports';
import {
  PgRatingRepository,
  type RatingView,
} from '../infra/db/pg-rating.repository';

export interface SubmitRatingInput {
  orderId: string;
  rating: number;
  tags: string[];
  comment?: string;
}

@Injectable()
export class RatingsService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    private readonly ratings: PgRatingRepository,
    private readonly idempotency: IdempotencyService,
  ) {}

  async submit(
    idempotencyKey: string,
    callerId: string,
    input: SubmitRatingInput,
  ): Promise<RatingView> {
    const order = await this.orders.findById(input.orderId);
    if (!order) throw new NotFoundError('order not found');
    if (order.userId !== callerId) {
      throw new ForbiddenError('can only rate your own order');
    }
    if (order.state !== 'COMPLETED') {
      throw new ConflictError(
        `only completed orders can be rated, not ${order.state}`,
      );
    }

    const { result } = await this.idempotency.execute(
      idempotencyKey,
      'order.rate',
      { orderId: input.orderId, userId: callerId },
      () =>
        this.ratings.insert({
          orderId: input.orderId,
          userId: callerId,
          rating: input.rating,
          tags: input.tags,
          comment: input.comment ?? null,
        }),
    );
    return result;
  }
}
