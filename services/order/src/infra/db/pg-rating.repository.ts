/** order_ratings writes. UNIQUE(order_id, user_id) is the DB-level dedup. */
import { Injectable } from '@nestjs/common';
import { ConflictError } from '@smartwash/common';
import { Database } from '@smartwash/nestkit';

export interface RatingView {
  id: string;
  orderId: string;
  userId: string;
  rating: number;
  tags: string[];
  comment: string | null;
  createdAt: string;
}

export interface InsertRatingData {
  orderId: string;
  userId: string;
  rating: number;
  tags: string[];
  comment: string | null;
}

@Injectable()
export class PgRatingRepository {
  constructor(private readonly db: Database) {}

  async insert(data: InsertRatingData): Promise<RatingView> {
    try {
      const { rows } = await this.db.getPool().query(
        `INSERT INTO order_ratings (order_id, user_id, rating, tags, comment)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [data.orderId, data.userId, data.rating, data.tags, data.comment],
      );
      const r = rows[0];
      return {
        id: r.id,
        orderId: r.order_id,
        userId: r.user_id,
        rating: r.rating,
        tags: r.tags,
        comment: r.comment,
        createdAt: r.created_at.toISOString(),
      };
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictError('order already rated');
      }
      throw e;
    }
  }
}
