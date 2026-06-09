/**
 * Wallet API — balance cache read (contracts/openapi/ledger.yaml → GET /wallets/{userId}).
 * Internal-only (InternalTokenGuard) AND independent RBAC re-check (RbacGuard,
 * rule #8). A user may only read their own wallet: the forwarded X-User-Id must
 * match the requested user.
 */
import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  InternalTokenGuard,
  RbacGuard,
  RequirePermission,
  USER_ID_HEADER,
} from '@smartwash/nestkit';
import { ForbiddenError } from '@smartwash/common';
import { WalletService } from '../application/wallet.service';
import type { WalletView } from '../domain/ports';

@Controller('wallets')
@UseGuards(InternalTokenGuard, RbacGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get(':userId')
  @RequirePermission('wallet.view.own')
  get(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Headers(USER_ID_HEADER) callerId: string | undefined,
  ): Promise<WalletView> {
    if (!callerId || callerId !== userId) {
      throw new ForbiddenError('can only view your own wallet');
    }
    return this.wallet.getBalance(userId);
  }
}
