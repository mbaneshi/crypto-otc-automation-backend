import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from '../../database/entities';
import { TenantRequest } from '../interfaces/tenant-request.interface';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly dataSource: DataSource,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<TenantRequest>();

    // Extract tenant identifier from subdomain or API key
    const subdomain = this.extractSubdomain(request);
    const apiKey = request.headers['x-api-key'] as string;

    if (!subdomain && !apiKey) {
      throw new UnauthorizedException('Tenant identification required');
    }

    // Resolve tenant
    const tenant = await this.resolveTenant(subdomain, apiKey);

    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant');
    }

    if (tenant.status !== 'active') {
      throw new UnauthorizedException('Tenant account is not active');
    }

    // Attach tenant to request
    request.tenant = tenant;
    request.tenantId = tenant.id;

    // Set database schema for this request
    await this.setDatabaseSchema(tenant.id);

    return next.handle();
  }

  private extractSubdomain(request: TenantRequest): string | null {
    const host = request.headers.host || request.hostname;
    if (!host) return null;

    // Extract subdomain (e.g., 'tenant1' from 'tenant1.otc-platform.com')
    const parts = host.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }

    // For development, check for subdomain query parameter
    if (request.query?.subdomain) {
      return request.query.subdomain as string;
    }

    return null;
  }

  private async resolveTenant(
    subdomain: string | null,
    apiKey: string | null,
  ): Promise<Tenant | null> {
    if (apiKey) {
      return await this.tenantRepository.findOne({
        where: { apiKey },
      });
    }

    if (subdomain) {
      return await this.tenantRepository.findOne({
        where: { subdomain },
      });
    }

    return null;
  }

  private async setDatabaseSchema(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;

    // Create schema if it doesn't exist
    await this.dataSource.query(
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
    );

    // Set search path to tenant schema
    await this.dataSource.query(
      `SET search_path TO "${schemaName}", public`,
    );
  }
}
