/**
 * Driver-facing endpoints. Resolves the driver row from the authenticated user,
 * enforces RBAC at the gateway (delivery.*, location.report) — the delivery/gps
 * services re-check independently. Drivers act only on their own deliveries.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ForbiddenError, ValidationError } from '@smartwash/common';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard, RequirePermission } from './permissions.guard';
import { AdvanceBffDto, ReportLocationDto } from './dto';
import { DeliveryClient, GpsClient } from '../infra/external/clients';
import { CatalogRepository } from '../infra/db/catalog.repository';
import { ReportingRepository } from '../infra/db/reporting.repository';

@Controller('bff/driver')
@UseGuards(BffAuthGuard, PermissionsGuard)
export class DriverController {
  constructor(
    private readonly deliveries: DeliveryClient,
    private readonly gps: GpsClient,
    private readonly catalog: CatalogRepository,
    private readonly reporting: ReportingRepository,
  ) {}

  private async driverId(req: AuthedRequest): Promise<string> {
    const id = await this.catalog.findDriverIdByUser(req.principal!.userId);
    if (!id) throw new ForbiddenError('not a registered driver');
    return id;
  }

  @Get('deliveries')
  @RequirePermission('delivery.view')
  async list(@Req() req: AuthedRequest): Promise<unknown> {
    return this.deliveries.listForDriver(req.principal!.userId, await this.driverId(req));
  }

  @Get('deliveries/:id')
  @RequirePermission('delivery.view')
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.deliveries.getDetail(id);
  }

  @Get('earnings')
  @RequirePermission('delivery.view')
  async earnings(@Req() req: AuthedRequest): Promise<unknown> {
    const driverId = await this.driverId(req);
    return this.reporting.driverEarnings(driverId);
  }

  @Post('deliveries/:id/accept')
  @HttpCode(200)
  @RequirePermission('delivery.accept')
  async accept(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.deliveries.accept(req.principal!.userId, id, await this.driverId(req));
  }

  @Post('deliveries/:id/reject')
  @HttpCode(200)
  @RequirePermission('delivery.accept')
  async reject(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.deliveries.reject(req.principal!.userId, id, await this.driverId(req));
  }

  @Post('deliveries/:id/advance')
  @HttpCode(200)
  @RequirePermission('delivery.update')
  async advance(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AdvanceBffDto,
  ): Promise<unknown> {
    return this.deliveries.advance(
      req.principal!.userId,
      id,
      await this.driverId(req),
      body.to,
    );
  }

  @Post('deliveries/:id/complete')
  @HttpCode(200)
  @RequirePermission('delivery.update')
  complete(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.deliveries.complete(req.principal!.userId, id);
  }

  @Post('location')
  @HttpCode(202)
  @RequirePermission('location.report')
  async location(
    @Req() req: AuthedRequest,
    @Body() body: ReportLocationDto,
  ): Promise<unknown> {
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
      throw new ValidationError('lat/lng required');
    }
    return this.gps.report(
      req.principal!.userId,
      await this.driverId(req),
      body.lat,
      body.lng,
    );
  }
}
