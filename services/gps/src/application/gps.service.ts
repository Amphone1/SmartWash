import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@smartwash/common';
import {
  GPS_REPOSITORY,
  type GpsRepository,
  type LastLocation,
  type Ping,
} from '../domain/ports';
import { GpsGateway } from '../infra/ws/gps.gateway';

@Injectable()
export class GpsService {
  constructor(
    @Inject(GPS_REPOSITORY) private readonly repo: GpsRepository,
    private readonly gateway: GpsGateway,
  ) {}

  /** Persist a ping and fan it out to trackers of this driver. */
  async ingest(ping: Ping): Promise<void> {
    await this.repo.record(ping);
    this.gateway.emitLocation(ping.driverId, {
      driverId: ping.driverId,
      lat: ping.lat,
      lng: ping.lng,
      heading: ping.heading ?? null,
      speed: ping.speed ?? null,
      ts: new Date().toISOString(),
    });
  }

  async last(driverId: string): Promise<LastLocation> {
    const loc = await this.repo.last(driverId);
    if (!loc) throw new NotFoundError('no location for driver');
    return loc;
  }
}
