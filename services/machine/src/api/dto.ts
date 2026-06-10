import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ReserveDto {
  @IsUUID()
  orderId!: string;
}

export class StartDto {
  @IsUUID()
  orderId!: string;

  @IsIn(['quick', 'normal', 'heavy'])
  cycle!: 'quick' | 'normal' | 'heavy';
}

export class StopDto {
  @IsOptional()
  @IsUUID()
  orderId?: string;
}
