import { Request } from 'express';
import { Tenant } from '../../database/entities';

export interface TenantRequest extends Request {
  tenant?: Tenant;
  tenantId?: string;
  user?: any;
}
