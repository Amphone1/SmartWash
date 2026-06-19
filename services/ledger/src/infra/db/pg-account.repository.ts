/**
 * Postgres adapter for chart-of-accounts resolution (EPIC A · A2).
 *
 * `resolve()` is a concurrency-safe get-or-create over `accounts`, run inside the
 * caller's transaction so account creation is atomic with the posting that needs
 * it. It validates the ref (fail-closed, pure), checks the owner entity exists for
 * non-singletons, then upserts on the natural key. Unused until A3/A4 wire it into
 * the posting path.
 */
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AccountInactiveError, AccountNotFoundError } from '@smartwash/common';
import { validateAccountRef, type AccountRef } from '../../domain/accounts';
import type { AccountResolver, ResolvedAccount } from '../../domain/ports';

interface AccountRow {
  id: string;
  acct_type: string;
  status: string;
}

/** owner_type → the table whose row authorizes a non-singleton account. */
const OWNER_TABLE: Readonly<Record<string, string>> = {
  user: 'users',
  branch: 'branches',
  staff: 'users', // staff/driver payouts are owed to a person (users.id)
};

@Injectable()
export class PgAccountRepository implements AccountResolver {
  async resolve(client: PoolClient, ref: AccountRef): Promise<ResolvedAccount> {
    const n = validateAccountRef(ref);

    // Owner existence (D8): an entity account must point at a real owner. Table
    // names come from a fixed whitelist, never from caller input.
    if (!n.singleton) {
      const table = OWNER_TABLE[n.ownerType];
      if (!table) {
        throw new AccountNotFoundError(`unsupported owner type ${n.ownerType}`);
      }
      const owner = await client.query(`SELECT 1 FROM ${table} WHERE id = $1`, [
        n.ownerId,
      ]);
      if (owner.rowCount === 0) {
        throw new AccountNotFoundError(
          `${n.ownerType} ${n.ownerId} does not exist`,
        );
      }
    }

    // Concurrency-safe get-or-create on the natural key. The no-op DO UPDATE
    // makes ON CONFLICT RETURN the existing row (DO NOTHING would not). The
    // NULLS NOT DISTINCT constraint makes this correct for singletons too.
    const res = await client.query<AccountRow>(
      `INSERT INTO accounts (acct_type, owner_type, owner_id, sub, currency, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON CONFLICT ON CONSTRAINT accounts_natural_key
         DO UPDATE SET status = accounts.status
       RETURNING id, acct_type, status`,
      [n.acctType, n.ownerType, n.ownerId, n.sub, n.currency],
    );

    const row = res.rows[0];
    if (row.status !== 'active') {
      throw new AccountInactiveError(`account ${n.accountKey} is ${row.status}`);
    }
    return {
      id: BigInt(row.id),
      acctType: row.acct_type as ResolvedAccount['acctType'],
      accountKey: n.accountKey,
    };
  }
}
