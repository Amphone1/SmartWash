/**
 * RBAC API (internal — called by the gateway and by services for re-checks).
 *   POST /rbac/check                         → { allowed, reason }
 *   GET  /rbac/users/:userId/permissions     → string[] (effective for branch)
 */
import { Controller, Get, Body, Param, Post, Query } from '@nestjs/common';
import { ValidationError } from '@smartwash/common';
import { RbacService } from '../application/rbac.service';
import { CheckDto } from './dto';
import type { Decision } from '../domain/policy';

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Post('check')
  check(@Body() body: CheckDto): Promise<Decision> {
    return this.rbac.check(body.userId, body.permission, body.branchId ?? null);
  }

  @Get('users/:userId/permissions')
  list(
    @Param('userId') userId: string,
    @Query('branchId') branchId?: string,
  ): Promise<string[]> {
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      throw new ValidationError('userId must be a UUID');
    }
    return this.rbac.listPermissions(userId, branchId ?? null);
  }
}
