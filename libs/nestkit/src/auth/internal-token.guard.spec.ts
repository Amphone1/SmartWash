import { InternalTokenGuard, INTERNAL_TOKEN_HEADER } from './internal-token.guard';

function ctxWith(headerValue: string | undefined) {
  const req = {
    header: (name: string) =>
      name === INTERNAL_TOKEN_HEADER ? headerValue : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

describe('InternalTokenGuard', () => {
  const guard = new InternalTokenGuard();
  const original = process.env.INTERNAL_SERVICE_TOKEN;

  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_SERVICE_TOKEN;
    else process.env.INTERNAL_SERVICE_TOKEN = original;
  });

  it('fails closed when the secret is not configured', () => {
    delete process.env.INTERNAL_SERVICE_TOKEN;
    expect(() => guard.canActivate(ctxWith('anything'))).toThrow();
  });

  it('rejects a wrong token', () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'super-secret';
    expect(() => guard.canActivate(ctxWith('nope'))).toThrow();
  });

  it('rejects a missing token', () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'super-secret';
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow();
  });

  it('accepts the correct token', () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'super-secret';
    expect(guard.canActivate(ctxWith('super-secret'))).toBe(true);
  });
});
