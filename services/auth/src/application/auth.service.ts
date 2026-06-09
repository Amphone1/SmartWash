/**
 * Authentication use-case: turn a bearer token into an AuthenticatedUser.
 * Identity is proven by the token (Keycloak); roles are loaded from our DB.
 */
import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError, ForbiddenError } from '@smartwash/common';
import type { AuthenticatedUser } from '../domain/identity';
import {
  TOKEN_VERIFIER,
  USER_DIRECTORY,
  type TokenVerifier,
  type UserDirectory,
} from '../domain/ports';

@Injectable()
export class AuthService {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    @Inject(USER_DIRECTORY) private readonly directory: UserDirectory,
  ) {}

  async authenticate(token: string): Promise<AuthenticatedUser> {
    let verified;
    try {
      verified = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedError('invalid or expired token');
    }

    const user = await this.directory.findByPhone(verified.phone);
    if (!user) {
      throw new UnauthorizedError('no local account for this identity');
    }
    if (user.status !== 'active') {
      throw new ForbiddenError(`account is ${user.status}`);
    }

    return {
      userId: user.id,
      phone: user.phone,
      name: user.name,
      roles: user.roles,
    };
  }
}
