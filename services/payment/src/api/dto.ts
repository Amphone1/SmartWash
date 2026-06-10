import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsIn(['topup', 'order'])
  type!: 'topup' | 'order';

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}

export class UploadSlipDto {
  @IsString()
  imageObjectKey!: string;

  // SHA-256 hex digest
  @Matches(/^[a-f0-9]{64}$/i, { message: 'slipHash must be a SHA-256 hex digest' })
  slipHash!: string;
}

export class OcrDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  ref!: string;

  @IsString()
  account!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number; // 0..1, stored as numeric(3,2)

  @IsOptional()
  @IsObject()
  json?: Record<string, unknown>;
}

export class DecisionDto {
  @IsIn(['PASS', 'MANUAL_REVIEW', 'REJECT'])
  state!: 'PASS' | 'MANUAL_REVIEW' | 'REJECT';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class StaffDecisionDto {
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';
}
