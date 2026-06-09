import { IsIn, IsInt, IsUUID } from 'class-validator';

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
}
