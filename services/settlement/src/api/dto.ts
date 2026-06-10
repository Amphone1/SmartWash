import { IsUUID, Matches } from 'class-validator';

export class RunSettlementDto {
  @IsUUID()
  branchId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;
}
