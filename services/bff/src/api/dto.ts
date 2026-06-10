import {
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

const ORDER_TYPES = ['self_service', 'pickup', 'delivery'] as const;
const CYCLES = ['quick', 'normal', 'heavy'] as const;

/** Customer-facing create-order body. userId is taken from the token, not here. */
export class CreateOrderBffDto {
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

/** Create a topup (or order) payment request via the BFF. */
export class CreatePaymentBffDto {
  @IsIn(['topup', 'order'])
  type!: 'topup' | 'order';

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}

export class UploadSlipBffDto {
  @IsString()
  imageObjectKey!: string;

  @Matches(/^[a-f0-9]{64}$/i, { message: 'slipHash must be a SHA-256 hex digest' })
  slipHash!: string;
}

const ADVANCE_STATES = ['EN_ROUTE_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'] as const;

export class AdvanceBffDto {
  @IsIn(ADVANCE_STATES)
  to!: (typeof ADVANCE_STATES)[number];
}

export class ReportLocationDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}
