import { deliveryFee, etaMinutes, haversineKm } from './geo';

describe('geo', () => {
  it('haversine ~0 for identical points', () => {
    expect(haversineKm({ lat: 17.96, lng: 102.6 }, { lat: 17.96, lng: 102.6 })).toBeCloseTo(0, 5);
  });

  it('haversine matches a known Vientiane distance roughly', () => {
    // ~ within Vientiane, a few km
    const km = haversineKm({ lat: 17.96, lng: 102.6 }, { lat: 17.98, lng: 102.63 });
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(6);
  });

  describe('deliveryFee', () => {
    const cfg = { baseFeeKip: 10000, perKmKip: 3000, minFeeKip: 10000 };
    it('is base + perKm*km, rounded, integer kip', () => {
      const fee = deliveryFee(4, cfg);
      expect(fee).toBe(22000);
      expect(Number.isInteger(fee)).toBe(true);
    });
    it('never below the minimum', () => {
      expect(deliveryFee(0, cfg)).toBe(10000);
    });
  });

  it('etaMinutes from distance and speed', () => {
    expect(etaMinutes(25, 25)).toBe(60);
    expect(etaMinutes(0)).toBe(0);
  });
});
