import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
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

class PlaceDto {
  @IsOptional()
  @IsString()
  addr?: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

/** Customer rating for a completed order (1–5 stars + tag chips). */
export class SubmitRatingDto {
  @IsUUID()
  orderId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @IsOptional()
  @IsString()
  comment?: string;
}

/** Request a pickup/delivery (carries addresses for the delivery_order saga). */
export class RequestDeliveryDto {
  @ValidateNested()
  @Type(() => PlaceDto)
  pickup!: PlaceDto;

  @ValidateNested()
  @Type(() => PlaceDto)
  dropoff!: PlaceDto;
}
