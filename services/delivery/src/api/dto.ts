import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class PlaceDto {
  @IsOptional()
  @IsString()
  addr?: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class CreateDeliveryDto {
  @IsUUID()
  orderId!: string;

  @ValidateNested()
  @Type(() => PlaceDto)
  pickup!: PlaceDto;

  @ValidateNested()
  @Type(() => PlaceDto)
  dropoff!: PlaceDto;
}

export class DriverActionDto {
  @IsUUID()
  driverId!: string;
}

const ADVANCE_STATES = [
  'EN_ROUTE_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
] as const;

export class AdvanceDto {
  @IsUUID()
  driverId!: string;

  @IsIn(ADVANCE_STATES)
  to!: (typeof ADVANCE_STATES)[number];
}
