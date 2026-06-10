/**
 * Delivery API. Internal-only (behind BFF); driver actions also RBAC-checked
 * (rule #8). Ownership (driver assigned to the delivery) is enforced in the
 * service. The customer payment lives in the gated delivery_order saga, not here.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  InternalTokenGuard,
  RbacGuard,
  RequirePermission,
} from '@smartwash/nestkit';
import { DeliveryService } from '../application/delivery.service';
import { AdvanceDto, CreateDeliveryDto, DriverActionDto } from './dto';
import type { DeliveryRecord } from '../domain/ports';

@Controller()
@UseGuards(InternalTokenGuard)
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post('internal/deliveries')
  @HttpCode(201)
  create(@Body() body: CreateDeliveryDto): Promise<DeliveryRecord> {
    return this.delivery.createForOrder(
      body.orderId,
      { addr: body.pickup.addr ?? null, lat: body.pickup.lat, lng: body.pickup.lng },
      { addr: body.dropoff.addr ?? null, lat: body.dropoff.lat, lng: body.dropoff.lng },
    );
  }

  @Get('deliveries/:id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<DeliveryRecord> {
    return this.delivery.getDelivery(id);
  }

  @Get('drivers/:driverId/deliveries')
  @UseGuards(RbacGuard)
  @RequirePermission('delivery.view')
  forDriver(
    @Param('driverId', new ParseUUIDPipe()) driverId: string,
    @Query('active') active?: string,
  ): Promise<DeliveryRecord[]> {
    return this.delivery.listForDriver(driverId, active !== 'false');
  }

  @Post('deliveries/:id/accept')
  @HttpCode(200)
  @UseGuards(RbacGuard)
  @RequirePermission('delivery.accept')
  accept(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DriverActionDto,
  ): Promise<DeliveryRecord> {
    return this.delivery.accept(id, body.driverId);
  }

  @Post('deliveries/:id/reject')
  @HttpCode(200)
  @UseGuards(RbacGuard)
  @RequirePermission('delivery.accept')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DriverActionDto,
  ): Promise<DeliveryRecord> {
    return this.delivery.reject(id, body.driverId);
  }

  @Post('deliveries/:id/advance')
  @HttpCode(200)
  @UseGuards(RbacGuard)
  @RequirePermission('delivery.update')
  advance(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdvanceDto,
  ): Promise<DeliveryRecord> {
    return this.delivery.advance(id, body.to, body.driverId);
  }

  @Post('deliveries/:id/complete')
  @HttpCode(200)
  complete(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DeliveryRecord> {
    return this.delivery.complete(id);
  }
}
