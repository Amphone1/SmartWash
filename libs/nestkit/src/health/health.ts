/**
 * Liveness + readiness endpoints (per CLAUDE.md per-service shape).
 *   GET /health/live   — process is up (always 200 unless the event loop is dead)
 *   GET /health/ready  — all registered readiness checks pass (else 503)
 *
 * A service registers readiness checks (DB ping, Redis ping, ...) by providing
 * the READINESS_CHECKS multi-token.
 */
import {
  Controller,
  type DynamicModule,
  Get,
  Inject,
  Injectable,
  type InjectionToken,
  Module,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface ReadinessCheck {
  name: string;
  check(): Promise<boolean> | boolean;
}

export const READINESS_CHECKS = Symbol('READINESS_CHECKS');

@Injectable()
export class HealthService {
  constructor(
    @Optional()
    @Inject(READINESS_CHECKS)
    private readonly checks: ReadinessCheck[] = [],
  ) {}

  async readiness(): Promise<{ status: string; checks: Record<string, string> }> {
    const results: Record<string, string> = {};
    let healthy = true;
    for (const c of this.checks ?? []) {
      try {
        const ok = await c.check();
        results[c.name] = ok ? 'up' : 'down';
        if (!ok) healthy = false;
      } catch {
        results[c.name] = 'down';
        healthy = false;
      }
    }
    if (!healthy) {
      throw new ServiceUnavailableException({ status: 'down', checks: results });
    }
    return { status: 'up', checks: results };
  }
}

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'up' };
  }

  @Get('ready')
  ready(): Promise<{ status: string; checks: Record<string, string> }> {
    return this.health.readiness();
  }
}

@Module({})
export class HealthModule {
  /**
   * Register the health endpoints. `checks` are injection tokens (classes or
   * symbols) that resolve to ReadinessCheck instances — typically Database,
   * RedisLock (both global), or service-specific checks exported from a global
   * module. Each is gathered into READINESS_CHECKS for /health/ready.
   */
  static forRoot(checks: InjectionToken[] = []): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: READINESS_CHECKS,
          useFactory: (...resolved: ReadinessCheck[]) => resolved,
          inject: checks,
        },
      ],
    };
  }
}
