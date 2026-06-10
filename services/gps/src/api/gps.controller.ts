/**
 * GPS API. Pings are internal (driver app → BFF → here) + RBAC location.report.
 * Last-known reads back the latest position (used by customer live tracking).
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  InternalTokenGuard,
  RbacGuard,
  RequirePermission,
} from '@smartwash/nestkit';
import { GpsService } from '../application/gps.service';
import { PingDto } from './dto';
import type { LastLocation } from '../domain/ports';

@Controller('gps')
@UseGuards(InternalTokenGuard)
export class GpsController {
  constructor(private readonly gps: GpsService) {}

  @Post('locations')
  @HttpCode(202)
  @UseGuards(RbacGuard)
  @RequirePermission('location.report')
  async ingest(@Body() body: PingDto): Promise<{ ok: boolean }> {
    await this.gps.ingest(body);
    return { ok: true };
  }

  @Get('drivers/:driverId/last')
  last(
    @Param('driverId', new ParseUUIDPipe()) driverId: string,
  ): Promise<LastLocation> {
    return this.gps.last(driverId);
  }
}
