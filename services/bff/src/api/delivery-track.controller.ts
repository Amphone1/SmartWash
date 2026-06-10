/**
 * Customer delivery tracking: view a delivery and its driver's last location.
 */
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BffAuthGuard } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { DeliveryClient, GpsClient } from '../infra/external/clients';

@Controller('bff/deliveries')
@UseGuards(BffAuthGuard, PermissionsGuard)
export class DeliveryTrackController {
  constructor(
    private readonly deliveries: DeliveryClient,
    private readonly gps: GpsClient,
  ) {}

  @Get(':id')
  @RequirePermission('order.view.own')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<unknown> {
    return this.deliveries.get(id);
  }

  @Get(':id/track')
  @RequirePermission('order.view.own')
  async track(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ deliveryId: string; location: unknown }> {
    const d = (await this.deliveries.get(id)) as { driverId?: string };
    const location = d.driverId ? await this.gps.last(d.driverId) : null;
    return { deliveryId: id, location };
  }
}
