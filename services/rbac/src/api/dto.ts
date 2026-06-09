import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

/** Body for POST /rbac/check. */
export class CheckDto {
  @IsUUID()
  userId!: string;

  // permission code, e.g. "order.refund"
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, {
    message: 'permission must be a dotted code like order.refund',
  })
  permission!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
