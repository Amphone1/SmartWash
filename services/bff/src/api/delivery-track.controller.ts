/**
 * Customer delivery tracking: view a delivery and its driver's last location.
 */
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotFoundError } from '@smartwash/common';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { DeliveryClient, GpsClient, OrderClient } from '../infra/external/clients';

@Controller('bff/deliveries')
@UseGuards(BffAuthGuard, PermissionsGuard)
export class DeliveryTrackController {
  constructor(
    private readonly deliveries: DeliveryClient,
    private readonly gps: GpsClient,
    private readonly orders: OrderClient,
  ) {}

  /**
   * order.view.own only proves the caller is a customer. A delivery row carries
   * no userId — ownership lives on its order — so resolve delivery → order and
   * verify the order belongs to the caller. Without this, any authenticated
   * user could read any delivery (and its driver's live GPS) by id. 404 on
   * mismatch so a non-owner can't enumerate delivery ids.
   */
  private async ownedDelivery(
    id: string,
    userId: string,
  ): Promise<{ orderId?: string; driverId?: string }> {
    const delivery = (await this.deliveries.get(id)) as {
      orderId?: string;
      driverId?: string;
    };
    const order = delivery.orderId
      ? ((await this.orders.get(delivery.orderId)) as { userId?: string })
      : null;
    if (!order || order.userId !== userId) {
      throw new NotFoundError('delivery not found');
    }
    return delivery;
  }

  @Get(':id')
  @RequirePermission('order.view.own')
  get(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.ownedDelivery(id, req.principal!.userId);
  }

  @Get(':id/track')
  @RequirePermission('order.view.own')
  async track(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ deliveryId: string; location: unknown }> {
    const d = await this.ownedDelivery(id, req.principal!.userId);
    const location = d.driverId ? await this.gps.last(d.driverId) : null;
    return { deliveryId: id, location };
  }
}
