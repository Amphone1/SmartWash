import type { Kip } from '@smartwash/common';
import type { OrderState } from './order-fsm';

export type OrderType = 'self_service' | 'pickup' | 'delivery';

export interface MachineInfo {
  id: string;
  branchId: string;
  code: string;
  type: string;
  price: Kip;
}

/** Reads machine reference data (price, branch) for pricing + validation. */
export interface MachineLookup {
  findById(machineId: string): Promise<MachineInfo | null>;
}
export const MACHINE_LOOKUP = Symbol('MACHINE_LOOKUP');

export interface OrderRecord {
  id: string;
  userId: string;
  branchId: string;
  machineId: string;
  type: OrderType;
  state: OrderState;
  subtotal: Kip;
  vat: Kip;
  total: Kip;
  createdAt: string;
}

export interface CreateOrderData {
  id: string;
  userId: string;
  branchId: string;
  machineId: string;
  type: OrderType;
  cycle?: string;
  addons?: string[];
  subtotal: Kip;
  vat: Kip;
  total: Kip;
}

/**
 * Persists orders + their FSM history + outbox events. All write methods commit
 * the domain row, the order_events row, and the outbox row in ONE transaction
 * (rule #4).
 */
export interface OrderRepository {
  create(data: CreateOrderData): Promise<OrderRecord>;
  findById(id: string): Promise<OrderRecord | null>;
  transition(
    id: string,
    from: OrderState,
    to: OrderState,
    event: string,
    outbox: { eventType: string; payload: Record<string, unknown> },
  ): Promise<OrderRecord>;
}
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
