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
import { InternalTokenGuard } from '@smartwash/nestkit';
import { OrdersService, type OrderView } from '../application/orders.service';
import { CreateOrderDto, TransitionOrderDto } from './dto';

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
