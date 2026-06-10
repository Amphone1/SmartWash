export interface DriverFees {
  driverId: string;
  trips: number;
  fees: bigint; // kip
}

export interface SettlementLineInput {
  driverId: string;
  trips: number;
  amount: bigint; // kip
}

export interface SettlementLineView {
  id: string;
  driverId: string | null;
  trips: number;
  amount: number;
  paid: boolean;
}

export interface SettlementView {
  id: string;
  branchId: string;
  periodDate: string;
  gross: number;
  platformRevenue: number;
  staffPayout: number;
  status: string;
  lines: SettlementLineView[];
}

export interface SettlementRepository {
  computeGross(branchId: string, date: string): Promise<bigint>;
  driverFees(branchId: string, date: string): Promise<DriverFees[]>;
  /** Upsert the settlement + replace its lines (only while status='open'). */
  save(
    branchId: string,
    date: string,
    gross: bigint,
    platformRevenue: bigint,
    staffPayout: bigint,
    lines: SettlementLineInput[],
  ): Promise<SettlementView>;
  list(branchId: string): Promise<SettlementView[]>;
  markLinePaid(lineId: string): Promise<void>;
  close(settlementId: string): Promise<void>;
}
export const SETTLEMENT_REPOSITORY = Symbol('SETTLEMENT_REPOSITORY');
