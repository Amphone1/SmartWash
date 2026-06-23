import { NotFoundError } from '@smartwash/common';
import { DeliveryTrackController } from './delivery-track.controller';
import type { AuthedRequest } from './auth.guard';
import type {
  DeliveryClient,
  GpsClient,
  OrderClient,
} from '../infra/external/clients';

/**
 * Regression guard: a delivery row has no userId — ownership lives on its order.
 * The tracking routes must resolve delivery → order → owner, or any
 * authenticated user could read any delivery and its driver's live GPS by id.
 */
describe('DeliveryTrackController — object-level ownership', () => {
  const id = '00000000-0000-4000-8000-000000000010';

  const setup = (delivery: unknown, order: unknown) => {
    const deliveries = {
      get: jest.fn().mockResolvedValue(delivery),
    } as unknown as DeliveryClient;
    const orders = {
      get: jest.fn().mockResolvedValue(order),
    } as unknown as OrderClient;
    const gps = {
      last: jest.fn().mockResolvedValue({ lat: 1, lng: 2 }),
    } as unknown as GpsClient;
    return {
      controller: new DeliveryTrackController(deliveries, gps, orders),
      gps,
    };
  };
  const reqFor = (userId: string) =>
    ({ principal: { userId } }) as unknown as AuthedRequest;

  it('returns the delivery to the owning customer', async () => {
    const delivery = { id, orderId: 'o1', driverId: 'drv1' };
    const { controller } = setup(delivery, { id: 'o1', userId: 'u1' });
    await expect(controller.get(reqFor('u1'), id)).resolves.toEqual(delivery);
  });

  it('404s a non-owner and never queries driver GPS (no IDOR / no location leak)', async () => {
    const { controller, gps } = setup(
      { id, orderId: 'o1', driverId: 'drv1' },
      { id: 'o1', userId: 'u2' },
    );
    await expect(controller.track(reqFor('u1'), id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(gps.last).not.toHaveBeenCalled();
  });
});
