/**
 * Auth API.
 *   GET  /auth/me         — authenticate the caller's bearer token, return the
 *                           principal (identity + branch-scoped roles).
 *   POST /auth/introspect — internal: resolve an arbitrary token into a
 *                           principal. The gateway/BFF calls this to authenticate
 *                           inbound requests before forwarding to services.
 */
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import { JwtAuthGuard, type AuthedRequest } from './jwt-auth.guard';
import { IntrospectDto } from './dto';
import type { AuthenticatedUser } from '../domain/identity';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest): AuthenticatedUser {
    // Guard guarantees req.user is set.
    return req.user as AuthenticatedUser;
  }

  @Post('introspect')
  introspect(@Body() body: IntrospectDto): Promise<AuthenticatedUser> {
    return this.auth.authenticate(body.token);
  }
}
