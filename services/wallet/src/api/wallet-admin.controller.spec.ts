import { ConflictError, ValidationError } from '@smartwash/common';
import { WalletAdminController } from './wallet-admin.controller';

/** Unit tests for the A8 seeding endpoint — mode routing + offline guard. */
describe('WalletAdminController.rebuild', () => {
  const orig = process.env.WALLET_PROJECTOR_V2_ENABLED;
  afterEach(() => {
    if (orig === undefined) delete process.env.WALLET_PROJECTOR_V2_ENABLED;
    else process.env.WALLET_PROJECTOR_V2_ENABLED = orig;
  });

  const makeProjection = () =>
    ({
      rebuildFromLedgerEntries: jest.fn().mockResolvedValue(3),
      rebuildFromPostings: jest.fn().mockResolvedValue(5),
    }) as unknown as import('../infra/db/pg-wallet-projection.repository').PgWalletProjectionRepository;

  it('defaults to the ledger_entries rebuild', async () => {
    delete process.env.WALLET_PROJECTOR_V2_ENABLED;
    const projection = makeProjection();
    const c = new WalletAdminController(projection);
    await expect(c.rebuild()).resolves.toEqual({ mode: 'ledger_entries', rows: 3 });
    expect(projection.rebuildFromLedgerEntries).toHaveBeenCalledTimes(1);
    expect(projection.rebuildFromPostings).not.toHaveBeenCalled();
  });

  it('runs the postings rebuild when asked', async () => {
    delete process.env.WALLET_PROJECTOR_V2_ENABLED;
    const projection = makeProjection();
    const c = new WalletAdminController(projection);
    await expect(c.rebuild('postings')).resolves.toEqual({ mode: 'postings', rows: 5 });
    expect(projection.rebuildFromPostings).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown mode', async () => {
    const projection = makeProjection();
    const c = new WalletAdminController(projection);
    await expect(c.rebuild('bogus')).rejects.toBeInstanceOf(ValidationError);
    expect(projection.rebuildFromLedgerEntries).not.toHaveBeenCalled();
  });

  it('refuses to rebuild while the projector is enabled (no force)', async () => {
    process.env.WALLET_PROJECTOR_V2_ENABLED = 'true';
    const projection = makeProjection();
    const c = new WalletAdminController(projection);
    await expect(c.rebuild('ledger_entries')).rejects.toBeInstanceOf(ConflictError);
    expect(projection.rebuildFromLedgerEntries).not.toHaveBeenCalled();
  });

  it('allows force=true to override the projector-enabled guard', async () => {
    process.env.WALLET_PROJECTOR_V2_ENABLED = 'true';
    const projection = makeProjection();
    const c = new WalletAdminController(projection);
    await expect(c.rebuild('ledger_entries', 'true')).resolves.toEqual({
      mode: 'ledger_entries',
      rows: 3,
    });
    expect(projection.rebuildFromLedgerEntries).toHaveBeenCalledTimes(1);
  });
});
