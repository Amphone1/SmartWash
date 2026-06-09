import { Module } from '@nestjs/common';
import {
  Database,
  DatabaseModule,
  HealthModule,
  MetricsModule,
} from '@smartwash/nestkit';
import { RbacController } from './api/rbac.controller';
import { RbacService } from './application/rbac.service';
import { POLICY_REPOSITORY } from './domain/ports';
import { PgPolicyRepository } from './infra/db/pg-policy.repository';

@Module({
  imports: [
    DatabaseModule,
    MetricsModule,
    HealthModule.forRoot([Database]),
  ],
  controllers: [RbacController],
  providers: [
    RbacService,
    { provide: POLICY_REPOSITORY, useClass: PgPolicyRepository },
  ],
})
export class AppModule {}
