/**
 * Saved delivery addresses for the authenticated customer. Thin proxy to the
 * delivery service, which re-checks the self-scope (rule #8).
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RateLimit, RateLimitGuard } from '@smartwash/nestkit';
import { BffAuthGuard, type AuthedRequest } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { CreateAddressBffDto } from './dto';
import { AddressesClient } from '../infra/external/clients';

@Controller('bff/addresses')
@UseGuards(BffAuthGuard, PermissionsGuard, RateLimitGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesClient) {}

  @Get()
  @RateLimit(60, 60, 'user')
  list(@Req() req: AuthedRequest): Promise<unknown> {
    return this.addresses.list(req.principal!.userId);
  }

  @Post()
  @HttpCode(201)
  @RateLimit(20, 60, 'user')
  create(
    @Req() req: AuthedRequest,
    @Body() body: CreateAddressBffDto,
  ): Promise<unknown> {
    return this.addresses.create(req.principal!.userId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RateLimit(20, 60, 'user')
  remove(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<unknown> {
    return this.addresses.remove(req.principal!.userId, id);
  }
}
