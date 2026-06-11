/**
 * Audit API (internal).
 *   POST /internal/audit — explicit actor actions (staff approve, admin refund…)
 *   GET  /audit          — inspection (BFF admin proxies here)
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';
import { InternalTokenGuard } from '@smartwash/nestkit';
import { PgAuditRepository, type AuditEntry } from '../infra/db/pg-audit.repository';

export class RecordAuditDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsString()
  @IsNotEmpty()
  actorRole!: string;

  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsObject()
  after?: Record<string, unknown>;
}

@Controller()
@UseGuards(InternalTokenGuard)
export class AuditController {
  constructor(private readonly repo: PgAuditRepository) {}

  @Post('internal/audit')
  @HttpCode(201)
  async record(@Body() body: RecordAuditDto): Promise<{ ok: boolean }> {
    await this.repo.append({
      actorId: body.actorId ?? null,
      actorRole: body.actorRole,
      action: body.action,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
      after: body.after ?? null,
    });
    return { ok: true };
  }

  @Get('audit')
  list(
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<AuditEntry[]> {
    return this.repo.list(
      entityId ?? null,
      limit ? Number.parseInt(limit, 10) : 50,
      before ? Number.parseInt(before, 10) : null,
    );
  }
}
