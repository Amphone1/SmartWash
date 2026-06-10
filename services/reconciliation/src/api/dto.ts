import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class StatementLineDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  ref?: string;

  @IsOptional()
  @IsString()
  sender?: string;

  @IsOptional()
  @IsISO8601()
  txnDate?: string;
}

export class RunReconDto {
  @IsUUID()
  branchId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => StatementLineDto)
  statementLines!: StatementLineDto[];
}
