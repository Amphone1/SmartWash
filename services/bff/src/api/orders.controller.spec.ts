import { NotFoundError } from '@smartwash/common';
import { OrdersController } from './orders.controller';
import type { AuthedRequest } from './auth.guard';
import type { OrderClient } from '../infra/external/clients';

/**
 * Regression guard for the object-level ownership check on GET /bff/orders/:id.
 * order.view.own only proves the caller is a customer; the controller must also
 * verify the order is theirs, else any authenticated user could read any order.
 */
describe('OrdersController.get — object-level ownership', () => {
  const id = '00000000-0000-4000-8000-000000000001';

  const makeController = (order: unknown) => {
    const orders = {
      get: jest.fn().mockResolvedValue(order),
    } as unknown as OrderClient;
    return new OrdersController(orders);
  };
  const reqFor = (userId: string) =>
    ({ principal: { userId } }) as unknown as AuthedRequest;

  it('returns the order when it belongs to the caller', async () => {
    const order = { id, userId: 'u1', state: 'PAID' };
    await expect(makeController(order).get(reqFor('u1'), id)).resolves.toEqual(
      order,
    );
  });

  it('404s when the order belongs to someone else (no IDOR)', async () => {
    const controller = makeController({ id, userId: 'u2', state: 'PAID' });
    await expect(controller.get(reqFor('u1'), id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('404s when the order is missing', async () => {
    await expect(
      makeController(null).get(reqFor('u1'), id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
