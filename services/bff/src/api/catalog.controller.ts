import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { BffAuthGuard } from './auth.guard';
import {
  CatalogRepository,
  type BranchView,
  type MachineView,
} from '../infra/db/catalog.repository';

/** Customer-app catalogue: branches → machines. Requires a logged-in user. */
@Controller('bff')
@UseGuards(BffAuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogRepository) {}

  @Get('branches')
  branches(): Promise<BranchView[]> {
    return this.catalog.listBranches();
  }

  @Get('branches/:branchId/machines')
  machines(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
  ): Promise<MachineView[]> {
    return this.catalog.listMachines(branchId);
  }
}
