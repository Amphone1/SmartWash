export interface Ping {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}

export interface LastLocation {
  driverId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
}

export interface GpsRepository {
  record(p: Ping): Promise<void>;
  last(driverId: string): Promise<LastLocation | null>;
}
export const GPS_REPOSITORY = Symbol('GPS_REPOSITORY');
