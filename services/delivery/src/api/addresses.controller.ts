/**
 * Saved-address API (internal). Self-scoped: the BFF forwards the authenticated
 * principal as X-User-Id and it must match the path user.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ForbiddenError, NotFoundError } from '@smartwash/common';
import { InternalTokenGuard, USER_ID_HEADER } from '@smartwash/nestkit';
import {
  PgAddressRepository,
  type AddressView,
} from '../infra/db/pg-address.repository';

export class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

function assertSelf(userId: string, callerId: string | undefined): void {
  if (!callerId || callerId !== userId) {
    throw new ForbiddenError('can only manage your own addresses');
  }
}

@Controller('users/:userId/addresses')
@UseGuards(InternalTokenGuard)
export class AddressesController {
  constructor(private readonly repo: PgAddressRepository) {}

  @Get()
  list(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Headers(USER_ID_HEADER) callerId: string | undefined,
  ): Promise<AddressView[]> {
    assertSelf(userId, callerId);
    return this.repo.listForUser(userId);
  }

  @Post()
  @HttpCode(201)
  create(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Headers(USER_ID_HEADER) callerId: string | undefined,
    @Body() body: CreateAddressDto,
  ): Promise<AddressView> {
    assertSelf(userId, callerId);
    return this.repo.create(userId, {
      label: body.label,
      address: body.address,
      lat: body.lat,
      lng: body.lng,
      isDefault: body.isDefault ?? false,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers(USER_ID_HEADER) callerId: string | undefined,
  ): Promise<void> {
    assertSelf(userId, callerId);
    const removed = await this.repo.remove(userId, id);
    if (!removed) throw new NotFoundError('address not found');
  }
}
