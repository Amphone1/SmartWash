import { Global, Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
} from '@smartwash/nestkit';
import { AuthController } from './api/auth.controller';
import { JwtAuthGuard } from './api/jwt-auth.guard';
import { AuthService } from './application/auth.service';
import { TOKEN_VERIFIER, USER_DIRECTORY } from './domain/ports';
import { KeycloakJwtVerifier } from './infra/external/keycloak-jwt.verifier';
import { PgUserDirectory } from './infra/db/pg-user-directory';

/**
 * Domain/adapter wiring. Marked @Global so the Keycloak verifier (a readiness
 * check) is resolvable by the platform HealthModule.
 */
@Global()
@Module({
  providers: [
    KeycloakJwtVerifier,
    PgUserDirectory,
    AuthService,
    { provide: TOKEN_VERIFIER, useExisting: KeycloakJwtVerifier },
    { provide: USER_DIRECTORY, useExisting: PgUserDirectory },
  ],
  exports: [AuthService, KeycloakJwtVerifier, TOKEN_VERIFIER, USER_DIRECTORY],
})
class AuthDomainModule {}

@Module({
  imports: [
    DatabaseModule,
    AuthDomainModule,
    MetricsModule,
    HealthModule.forRoot([Database, KeycloakJwtVerifier]),
  ],
  controllers: [AuthController],
  providers: [JwtAuthGuard],
})
export class AppModule {}
