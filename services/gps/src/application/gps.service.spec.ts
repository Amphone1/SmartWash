import { GpsService } from './gps.service';
import type { GpsRepository, LastLocation, Ping } from '../domain/ports';

const DRIVER = '55555555-5555-4555-8555-555555555555';

class FakeRepo implements GpsRepository {
  pings: Ping[] = [];
  async record(p: Ping) {
    this.pings.push(p);
  }
  async last(driverId: string): Promise<LastLocation | null> {
    const p = [...this.pings].reverse().find((x) => x.driverId === driverId);
    if (!p) return null;
    return {
      driverId,
      lat: p.lat,
      lng: p.lng,
      heading: p.heading ?? null,
      speed: p.speed ?? null,
      recordedAt: new Date().toISOString(),
    };
  }
}

class FakeGateway {
  emitted: { driverId: string; location: Record<string, unknown> }[] = [];
  emitLocation(driverId: string, location: Record<string, unknown>) {
    this.emitted.push({ driverId, location });
  }
}

function make() {
  const repo = new FakeRepo();
  const gw = new FakeGateway();
  const svc = new GpsService(repo, gw as never);
  return { svc, repo, gw };
}

describe('GpsService', () => {
  it('records a ping and broadcasts it to the driver room', async () => {
    const { svc, repo, gw } = make();
    await svc.ingest({ driverId: DRIVER, lat: 17.96, lng: 102.6, heading: 90 });
    expect(repo.pings).toHaveLength(1);
    expect(gw.emitted[0].driverId).toBe(DRIVER);
    expect(gw.emitted[0].location).toMatchObject({ lat: 17.96, lng: 102.6, heading: 90 });
  });

  it('returns the last known location', async () => {
    const { svc } = make();
    await svc.ingest({ driverId: DRIVER, lat: 1, lng: 1 });
    await svc.ingest({ driverId: DRIVER, lat: 2, lng: 2 });
    const last = await svc.last(DRIVER);
    expect(last.lat).toBe(2);
  });

  it('404s when no location exists', async () => {
    const { svc } = make();
    await expect(svc.last(DRIVER)).rejects.toMatchObject({ status: 404 });
  });
});
