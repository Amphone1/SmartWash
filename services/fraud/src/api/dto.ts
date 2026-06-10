import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  Max,
  Min,
} from 'class-validator';

export class EvaluateDto {
  @IsBoolean()
  duplicate!: boolean;

  @IsBoolean()
  accountMatch!: boolean;

  @IsInt()
  @Min(0)
  amountExpected!: number;

  @IsInt()
  @Min(0)
  ocrAmount!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  ocrConfidence!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  riskScore!: number;

  @IsIn(['low', 'medium', 'high'])
  riskBand!: 'low' | 'medium' | 'high';
}
