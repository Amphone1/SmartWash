/**
 * Order API (contracts/openapi/order.yaml). Internal-only: protected by the
 * shared-secret guard; the BFF/gateway authenticates the end user and enforces
 * RBAC before calling here (rule #8 re-check lives at the gateway for Phase 1).
 *
 * Every state-changing POST requires an Idempotency-Key header (rule #3).
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import { InternalTokenGuard, USER_ID_HEADER } from '@smartwash/nestkit';
import { OrdersService, type OrderView } from '../application/orders.service';
import { CreateOrderDto, RequestDeliveryDto, TransitionOrderDto } from './dto';

@Controller('orders')
@UseGuards(InternalTokenGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(201)
  create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateOrderDto,
  ): Promise<OrderView> {
    return this.orders.createOrder(requireKey(idempotencyKey), body);
  }

  /** The authenticated user's own orders (BFF forwards the principal). */
  @Get()
  list(
    @Headers(USER_ID_HEADER) userId: string | undefined,
  ): Promise<OrderView[]> {
    if (!userId) throw new ValidationError(`${USER_ID_HEADER} header is required`);
    return this.orders.listForUser(userId);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.getOrder(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<OrderView> {
    return this.orders.cancelOrder(requireKey(idempotencyKey), id);
  }

  /** Explicit start-wash (behind BFF) — emits wash_requested for the saga. */
  @Post(':id/request-wash')
  @HttpCode(202)
  requestWash(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ orderId: string; status: string }> {
    return this.orders.requestWash(id);
  }

  /** Explicit request-delivery (behind BFF) — emits delivery_requested. */
  @Post(':id/request-delivery')
  @HttpCode(202)
  requestDelivery(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RequestDeliveryDto,
  ): Promise<{ orderId: string; status: string }> {
    return this.orders.requestDelivery(id, { ...body.pickup }, { ...body.dropoff });
  }

  /** Release the machine reservation lock (internal — saga finalize/comp). */
  @Post(':id/release-lock')
  @HttpCode(200)
  releaseLock(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ released: boolean }> {
    return this.orders.releaseReservation(id);
  }

  /** Saga-driven FSM transition (internal — wash_order saga). */
  @Post(':id/transition')
  @HttpCode(200)
  transition(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: TransitionOrderDto,
  ): Promise<OrderView> {
    return this.orders.transitionTo(id, body.to, body.event);
  }
}

function requireKey(key: string | undefined): string {
  if (!key) throw new ValidationError('Idempotency-Key header is required');
  return key;
}
