import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantRequest } from '../interfaces/tenant-request.interface';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();
    return request.tenant;
  },
);

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<TenantRequest>();
    return request.tenantId || request.tenant?.id;
  },
);
