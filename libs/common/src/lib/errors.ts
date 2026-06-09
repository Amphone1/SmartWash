/**
 * Domain error taxonomy shared across services. Each carries a stable `code`
 * (for clients / logs) and an HTTP `status` the gateway/BFF can map directly.
 */

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Request body / params failed validation. */
export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('validation_error', message, 400, details);
  }
}

/** A unique/business invariant was violated (e.g. machine already locked). */
export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('conflict', message, 409, details);
  }
}

/** Resource does not exist. */
export class NotFoundError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('not_found', message, 404, details);
  }
}

/** No / invalid credentials — caller is not authenticated. */
export class UnauthorizedError extends DomainError {
  constructor(message = 'unauthorized', details?: unknown) {
    super('unauthorized', message, 401, details);
  }
}

/** Authenticated but lacks the required permission/role. */
export class ForbiddenError extends DomainError {
  constructor(message = 'forbidden', details?: unknown) {
    super('forbidden', message, 403, details);
  }
}

/** Wallet/credit cannot cover the requested deduct. */
export class InsufficientFundsError extends DomainError {
  constructor(message = 'insufficient funds', details?: unknown) {
    super('insufficient_funds', message, 402, details);
  }
}

/**
 * Same Idempotency-Key replayed with a *different* request body — the caller
 * is reusing a key they should not. (A replay with the same body is NOT an
 * error; it returns the stored response.)
 */
export class IdempotencyConflictError extends DomainError {
  constructor(message = 'idempotency key reused with a different payload') {
    super('idempotency_conflict', message, 422);
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
