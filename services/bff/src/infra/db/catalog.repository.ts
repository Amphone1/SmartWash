/**
 * Read-only catalogue queries for the customer app (branches + machines). These
 * are reference reads the BFF serves directly; no dedicated service in Phase 1.
 */
import { Injectable } from '@nestjs/common';
import { Database } from '@smartwash/nestkit';

export interface BranchView {
  id: string;
  name: string;
  nameLao: string | null;
  lat: number;
  lng: number;
  status: string;
}

export interface MachineView {
  id: string;
  code: string;
  type: string;
  capacityKg: number;
  price: number;
  state: string; // live state if known, else OFFLINE
}

@Injectable()
export class CatalogRepository {
  constructor(private readonly db: Database) {}

  async listBranches(): Promise<BranchView[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT id, name, name_lao, lat, lng, status
         FROM branches WHERE status = 'open' ORDER BY name`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      nameLao: r.name_lao,
      lat: r.lat,
      lng: r.lng,
      status: r.status,
    }));
  }

  async listMachines(branchId: string): Promise<MachineView[]> {
    const { rows } = await this.db.getPool().query(
      `SELECT m.id, m.code, m.type, m.capacity_kg, m.price,
              COALESCE(ms.state, 'OFFLINE') AS state
         FROM machines m
         LEFT JOIN machine_status ms ON ms.machine_id = m.id
        WHERE m.branch_id = $1
        ORDER BY m.code`,
      [branchId],
    );
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      capacityKg: r.capacity_kg,
      price: Number(r.price),
      state: r.state,
    }));
  }
}
