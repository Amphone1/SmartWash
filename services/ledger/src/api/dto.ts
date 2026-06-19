import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const TYPES = ['TOPUP', 'DEDUCT', 'REFUND_REVERSAL', 'ADJUSTMENT'] as const;
const REF_TYPES = ['order', 'topup', 'refund', 'recon'] as const;

export class PostEntryDto {
  @IsUUID()
  userId!: string;

  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  // signed kip; sign validated against `type` in the domain layer
  @IsInt()
  amount!: number;

  @IsIn(REF_TYPES)
  refType!: (typeof REF_TYPES)[number];

  @IsUUID()
  refId!: string;

  // A5 dual-write context (additive, optional). Used only to build the shadow
  // mirror; no effect on the authoritative legacy write.
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  vatBps?: number;

  @IsOptional()
  @IsIn(['wash', 'delivery'])
  channel?: 'wash' | 'delivery';
}

export class RefundDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  orderId!: string;

  @IsInt()
  @Min(1)
  amount!: number; // positive kip credited back

  @IsIn(['FULL', 'PARTIAL'])
  type!: 'FULL' | 'PARTIAL';

  @IsOptional()
  @IsString()
  reason?: string;

  // A5 dual-write context (additive, optional).
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  vatBps?: number;
}
