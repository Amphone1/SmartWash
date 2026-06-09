import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';
import type { MachineInfo, MachineLookup } from '../../domain/ports';

interface Row {
  id: string;
  branch_id: string;
  code: string;
  type: string;
  price: string;
}

@Injectable()
export class PgMachineLookup implements MachineLookup {
  constructor(private readonly db: Database) {}

  async findById(machineId: string): Promise<MachineInfo | null> {
    const { rows } = await this.db.getPool().query<Row>(
      `SELECT id, branch_id, code, type, price FROM machines WHERE id = $1`,
      [machineId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      branchId: r.branch_id,
      code: r.code,
      type: r.type,
      price: BigInt(r.price),
    };
  }
}
