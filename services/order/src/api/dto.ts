import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

const ORDER_TYPES = ['self_service', 'pickup', 'delivery'] as const;
const CYCLES = ['quick', 'normal', 'heavy'] as const;
const ORDER_STATES = [
  'CREATED',
  'RESERVED',
  'PAYMENT_PENDING',
  'AWAITING_APPROVAL',
  'PAID',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'REJECTED',
  'REFUND_PENDING',
  'REFUNDED',
] as const;

export class CreateOrderDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  branchId!: string;

  @IsUUID()
  machineId!: string;

  @IsIn(ORDER_TYPES)
  type!: (typeof ORDER_TYPES)[number];

  @IsOptional()
  @IsIn(CYCLES)
  cycle?: (typeof CYCLES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addons?: string[];
}

/** Saga-driven FSM transition (internal). */
export class TransitionOrderDto {
  @IsIn(ORDER_STATES)
  to!: (typeof ORDER_STATES)[number];

  @IsString()
  @IsNotEmpty()
  event!: string;
}
