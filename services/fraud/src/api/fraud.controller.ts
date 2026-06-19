/**
 * Fraud API — internal-only decision endpoint called by the topup saga.
 * Stateless: no DB writes (the slip_hash UNIQUE guard lives in the Payment
 * service / DB; this returns the categorical PASS/MANUAL_REVIEW/REJECT gate).
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalTokenGuard } from '@smartwash/nestkit';
import { decide, type FraudDecision } from '../domain/fraud-policy';
import { EvaluateDto } from './dto';

@Controller('fraud')
@UseGuards(InternalTokenGuard)
export class FraudController {
  @Post('evaluate')
  evaluate(@Body() body: EvaluateDto): FraudDecision {
    return decide({
      ...body,
      amountExpected: BigInt(body.amountExpected),
      ocrAmount: BigInt(body.ocrAmount),
    });
  }
}
