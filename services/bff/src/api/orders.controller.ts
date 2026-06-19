import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotFoundError, ValidationError } from '@smartwash/common';
import { RateLimit, RateLimitGuard } from '@smartwash/nestkit';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { CreateOrderBffDto, RequestDeliveryBffDto } from './dto';
import { OrderClient } from '../infra/external/clients';

@Controller('bff/orders')
@UseGuards(BffAuthGuard, PermissionsGuard, RateLimitGuard)
export class OrdersController {
  constructor(private readonly orders: OrderClient) {}

  @Post()
  @HttpCode(201)
  @RequirePermission('order.create')
  @RateLimit(30, 60, 'user')
  create(
    @Req() req: AuthedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CreateOrderBffDto,
  ): Promise<unknown> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    // userId comes from the authenticated principal — never the request body.
    return this.orders.create(key, { ...body, userId: req.principal!.userId });
  }

  /** List the authenticated user's own orders (last 100). */
  @Get()
  @RequirePermission('order.view.own')
  list(@Req() req: AuthedRequest): Promise<unknown> {
    return this.orders.listForUser(req.principal!.userId);
  }

  @Get(':id')
  @RequirePermission('order.view.own')
  async get(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    // order.view.own proves the caller is a customer — NOT that this order is
    // theirs. Enforce object-level ownership at the public boundary (the
    // principal lives here). 404, not 403, so a non-owner can't enumerate ids.
    const order = (await this.orders.get(id)) as { userId?: string };
    if (order?.userId !== req.principal!.userId) {
      throw new NotFoundError('order not found');
    }
    return order;
  }

  @Post(':id/start')
  @HttpCode(202)
  @RequirePermission('order.create')
  @RateLimit(10, 60, 'user')
  start(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.orders.requestWash(req.principal!.userId, id);
  }

  @Post(':id/request-delivery')
  @HttpCode(202)
  @RequirePermission('delivery.request')
  requestDelivery(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RequestDeliveryBffDto,
  ): Promise<unknown> {
    return this.orders.requestDelivery(req.principal!.userId, id, body);
  }
}
