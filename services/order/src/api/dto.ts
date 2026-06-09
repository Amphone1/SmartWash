import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

const ORDER_TYPES = ['self_service', 'pickup', 'delivery'] as const;
const CYCLES = ['quick', 'normal', 'heavy'] as const;

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
