/**
 * Keycloak adapter: verifies RS256 JWTs against the realm's published JWKS
 * (rotated keys handled by jose's remote key set cache). Checks issuer and,
 * when configured, audience.
 */
import { Injectable, Logger } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { optionalEnv, requireEnv, type ReadinessCheck } from '@smartwash/nestkit';
import type { TokenVerifier } from '../../domain/ports';
import type { VerifiedToken } from '../../domain/identity';

interface KeycloakClaims extends JWTPayload {
  preferred_username?: string;
  name?: string;
  realm_access?: { roles?: string[] };
}

@Injectable()
export class KeycloakJwtVerifier implements TokenVerifier, ReadinessCheck {
  readonly name = 'keycloak';
  private readonly logger = new Logger('KeycloakJwtVerifier');
  private readonly issuer: string;
  private readonly audience?: string;
  /** In-network realm base for JWKS/readiness (may differ from the issuer). */
  private readonly realmBase: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor() {
    const base = requireEnv('KEYCLOAK_URL').replace(/\/+$/, '');
    const realm = requireEnv('KEYCLOAK_REALM');
    this.realmBase = `${base}/realms/${realm}`;
    // When Keycloak's public hostname differs from its in-network address
    // (KC_HOSTNAME set for device testing / prod), tokens carry the PUBLIC
    // issuer while keys must still be fetched over the internal URL.
    const issuerBase =
      optionalEnv('KEYCLOAK_ISSUER_URL', '').replace(/\/+$/, '') || base;
    this.issuer = `${issuerBase}/realms/${realm}`;
    this.audience = optionalEnv('KEYCLOAK_AUDIENCE', '') || undefined;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.realmBase}/protocol/openid-connect/certs`),
    );
  }

  async verify(token: string): Promise<VerifiedToken> {
    const { payload } = await jwtVerify<KeycloakClaims>(token, this.jwks, {
      issuer: this.issuer,
      audience: this.audience,
    });

    const phone = payload.preferred_username;
    if (!payload.sub || !phone) {
      throw new Error('token missing sub/preferred_username');
    }
    return {
      subject: payload.sub,
      phone,
      name: payload.name,
      realmRoles: payload.realm_access?.roles ?? [],
    };
  }

  /** Readiness: the realm JWKS endpoint is reachable. */
  async check(): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.realmBase}/protocol/openid-connect/certs`,
        { method: 'GET' },
      );
      return res.ok;
    } catch (err) {
      this.logger.warn(`keycloak JWKS unreachable: ${String(err)}`);
      return false;
    }
  }
}
