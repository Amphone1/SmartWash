/**
 * Customer-facing topup + wallet endpoints. Authenticates the user (BffAuthGuard)
 * and enforces RBAC at the gateway (PermissionsGuard) — the money services
 * re-check independently. userId is always the authenticated principal.
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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import { RateLimit, RateLimitGuard } from '@smartwash/nestkit';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { CreatePaymentBffDto, SubmitRatingBffDto, UploadSlipBffDto } from './dto';
import {
  NotificationClient,
  PaymentClient,
  RatingsClient,
  WalletClient,
} from '../infra/external/clients';

function requireKey(key: string | undefined): string {
  if (!key) throw new ValidationError('Idempotency-Key header is required');
  return key;
}

@Controller('bff')
@UseGuards(BffAuthGuard, PermissionsGuard, RateLimitGuard)
export class TopupController {
  constructor(
    private readonly payments: PaymentClient,
    private readonly wallets: WalletClient,
    private readonly notifications: NotificationClient,
    private readonly ratings: RatingsClient,
  ) {}

  @Post('payments')
  @HttpCode(201)
  @RequirePermission('payment.create')
  @RateLimit(5, 60, 'user')
  createPayment(
    @Req() req: AuthedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CreatePaymentBffDto,
  ): Promise<unknown> {
    return this.payments.create(requireKey(key), req.principal!.userId, body);
  }

  @Post('payments/:qrRef/slip')
  @HttpCode(202)
  @RequirePermission('payment.create')
  @RateLimit(10, 60, 'user')
  uploadSlip(
    @Req() req: AuthedRequest,
    @Param('qrRef') qrRef: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: UploadSlipBffDto,
  ): Promise<unknown> {
    return this.payments.uploadSlip(
      requireKey(key),
      req.principal!.userId,
      qrRef,
      body,
    );
  }

  @Get('payments/:qrRef')
  paymentStatus(
    @Req() req: AuthedRequest,
    @Param('qrRef') qrRef: string,
  ): Promise<unknown> {
    return this.payments.getStatus(req.principal!.userId, qrRef);
  }

  @Get('wallet')
  @RequirePermission('wallet.view.own')
  wallet(@Req() req: AuthedRequest): Promise<unknown> {
    return this.wallets.get(req.principal!.userId);
  }

  /** The authenticated user's own notifications (self-scoped downstream too). */
  @Get('notifications')
  @RateLimit(60, 60, 'user')
  notificationsList(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.notifications.listForUser(
      req.principal!.userId,
      limit ? Number.parseInt(limit, 10) : undefined,
    );
  }

  @Post('notifications/read-all')
  @HttpCode(204)
  @RateLimit(10, 60, 'user')
  markAllRead(@Req() req: AuthedRequest): Promise<unknown> {
    return this.notifications.markAllRead(req.principal!.userId);
  }

  @Post('ratings')
  @HttpCode(201)
  @RequirePermission('order.view.own')
  @RateLimit(20, 60, 'user')
  submitRating(
    @Req() req: AuthedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: SubmitRatingBffDto,
  ): Promise<unknown> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    return this.ratings.submit(key, req.principal!.userId, body);
  }
}
