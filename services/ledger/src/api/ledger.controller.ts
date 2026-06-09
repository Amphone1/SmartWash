/**
 * Ledger & Wallet API (contracts/openapi/ledger.yaml).
 *   POST /ledger/post            — system-internal (saga/payment). InternalTokenGuard
 *                                  only; the Idempotency-Key header becomes the
 *                                  entry's UNIQUE idempotency_key.
 *   GET  /wallets/:id/entries    — history; InternalTokenGuard + independent RBAC
 *                                  re-check + self-only.
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ForbiddenError, toKip, ValidationError } from '@smartwash/common';
import {
  InternalTokenGuard,
  RbacGuard,
  RequirePermission,
  USER_ID_HEADER,
} from '@smartwash/nestkit';
import { LedgerService } from '../application/ledger.service';
import { PostEntryDto } from './dto';
import type { LedgerEntryView } from '../domain/ledger';

@Controller()
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Post('ledger/post')
  @UseGuards(InternalTokenGuard)
  async post(
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: PostEntryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LedgerEntryView> {
    if (!key) throw new ValidationError('Idempotency-Key header is required');
    const { entry, replayed } = await this.ledger.post({
      userId: body.userId,
      type: body.type,
      amount: toKip(body.amount),
      refType: body.refType,
      refId: body.refId,
      idempotencyKey: key,
    });
    res.status(replayed ? 200 : 201);
    return entry;
  }

  @Get('wallets/:userId/entries')
  @UseGuards(InternalTokenGuard, RbacGuard)
  @RequirePermission('wallet.view.own')
  entries(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Headers(USER_ID_HEADER) callerId: string | undefined,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<LedgerEntryView[]> {
    if (!callerId || callerId !== userId) {
      throw new ForbiddenError('can only view your own entries');
    }
    return this.ledger.listEntries(
      userId,
      limit ? Number.parseInt(limit, 10) : 50,
      cursor ? Number.parseInt(cursor, 10) : null,
    );
  }
}
