/**
 * Ratings API (internal). The BFF authenticates the customer and forwards the
 * principal as X-User-Id; a rating is always recorded for that caller.
 */
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ForbiddenError, ValidationError } from '@smartwash/common';
import { InternalTokenGuard, USER_ID_HEADER } from '@smartwash/nestkit';
import {
  RatingsService,
} from '../application/ratings.service';
import type { RatingView } from '../infra/db/pg-rating.repository';
import { SubmitRatingDto } from './dto';

@Controller('ratings')
@UseGuards(InternalTokenGuard)
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post()
  @HttpCode(201)
  submit(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers(USER_ID_HEADER) callerId: string | undefined,
    @Body() body: SubmitRatingDto,
  ): Promise<RatingView> {
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key header is required');
    }
    if (!callerId) throw new ForbiddenError('caller identity is required');
    return this.ratings.submit(idempotencyKey, callerId, body);
  }
}
