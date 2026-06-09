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
import { ValidationError } from '@smartwash/common';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { CreateOrderBffDto } from './dto';
import { OrderClient } from '../infra/external/clients';

@Controller('bff/orders')
@UseGuards(BffAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly orders: OrderClient) {}

  @Post()
  @HttpCode(201)
  @RequirePermission('order.create')
  create(
    @Req() req: AuthedRequest,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CreateOrderBffDto,
  ): Promise<unknown> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    // userId comes from the authenticated principal — never the request body.
    return this.orders.create(key, { ...body, userId: req.principal!.userId });
  }

  @Get(':id')
  @RequirePermission('order.view.own')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    return this.orders.get(id);
  }
}
