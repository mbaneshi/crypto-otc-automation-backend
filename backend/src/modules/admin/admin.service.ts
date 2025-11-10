import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, KycStatus } from '../../database/entities/user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { Order } from '../../database/entities/order.entity';
import { Payment } from '../../database/entities/payment.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Reconciliation } from '../../database/entities/reconciliation.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Reconciliation)
    private readonly reconciliationRepository: Repository<Reconciliation>,
  ) {}

  async getAllUsers(page = 1, limit = 50): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { users, total };
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.getUserById(userId);

    user.role = role;
    await this.userRepository.save(user);

    await this.createAuditLog({
      userId,
      action: 'USER_ROLE_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { newRole: role },
    });

    this.logger.log(`User ${userId} role updated to ${role}`);

    return user;
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    const user = await this.getUserById(userId);

    user.isActive = isActive;
    await this.userRepository.save(user);

    await this.createAuditLog({
      userId,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: userId,
      metadata: { isActive },
    });

    this.logger.log(`User ${userId} ${isActive ? 'activated' : 'deactivated'}`);

    return user;
  }

  async updateUserKycStatus(userId: string, kycStatus: KycStatus): Promise<User> {
    const user = await this.getUserById(userId);

    user.kycStatus = kycStatus;

    if (kycStatus === KycStatus.APPROVED) {
      user.kycApprovedAt = new Date();
      user.kycExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else if (kycStatus === KycStatus.REJECTED) {
      user.kycApprovedAt = null;
      user.kycExpiresAt = null;
    }

    await this.userRepository.save(user);

    await this.createAuditLog({
      userId,
      action: 'KYC_STATUS_MANUALLY_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { newStatus: kycStatus },
    });

    this.logger.log(`User ${userId} KYC status updated to ${kycStatus}`);

    return user;
  }

  async getAllTenants(): Promise<Tenant[]> {
    return this.tenantRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getTenantById(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async createTenant(data: {
    name: string;
    apiKey: string;
    config: any;
  }): Promise<Tenant> {
    const existingTenant = await this.tenantRepository.findOne({
      where: { apiKey: data.apiKey },
    });

    if (existingTenant) {
      throw new BadRequestException('Tenant with this API key already exists');
    }

    const tenant = this.tenantRepository.create({
      name: data.name,
      apiKey: data.apiKey,
      config: data.config,
      isActive: true,
    });

    await this.tenantRepository.save(tenant);

    this.logger.log(`Tenant created: ${tenant.name}`);

    return tenant;
  }

  async updateTenant(
    tenantId: string,
    data: { name?: string; config?: any; isActive?: boolean },
  ): Promise<Tenant> {
    const tenant = await this.getTenantById(tenantId);

    if (data.name !== undefined) {
      tenant.name = data.name;
    }

    if (data.config !== undefined) {
      tenant.config = data.config;
    }

    if (data.isActive !== undefined) {
      tenant.isActive = data.isActive;
    }

    await this.tenantRepository.save(tenant);

    this.logger.log(`Tenant updated: ${tenant.name}`);

    return tenant;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    const tenant = await this.getTenantById(tenantId);

    await this.tenantRepository.remove(tenant);

    this.logger.log(`Tenant deleted: ${tenant.name}`);
  }

  async getAllOrders(page = 1, limit = 50): Promise<{ orders: Order[]; total: number }> {
    const [orders, total] = await this.orderRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    return { orders, total };
  }

  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getAllPayments(page = 1, limit = 50): Promise<{ payments: Payment[]; total: number }> {
    const [payments, total] = await this.paymentRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['order', 'order.user'],
    });

    return { payments, total };
  }

  async getAuditLogs(
    page = 1,
    limit = 50,
    filters?: { userId?: string; action?: string },
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const query = this.auditLogRepository.createQueryBuilder('log');

    if (filters?.userId) {
      query.andWhere('log.userId = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      query.andWhere('log.action = :action', { action: filters.action });
    }

    query.skip((page - 1) * limit).take(limit).orderBy('log.createdAt', 'DESC');

    const [logs, total] = await query.getManyAndCount();

    return { logs, total };
  }

  async getReconciliations(page = 1, limit = 50): Promise<{ reconciliations: Reconciliation[]; total: number }> {
    const [reconciliations, total] = await this.reconciliationRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { reconciliations, total };
  }

  async getPlatformStats(): Promise<any> {
    const [totalUsers, totalOrders, totalPayments, totalTenants] = await Promise.all([
      this.userRepository.count(),
      this.orderRepository.count(),
      this.paymentRepository.count(),
      this.tenantRepository.count(),
    ]);

    const [activeUsers, completedOrders, completedPayments, activeTenants] = await Promise.all([
      this.userRepository.count({ where: { isActive: true } }),
      this.orderRepository.count({ where: { status: 'completed' } }),
      this.paymentRepository.count({ where: { status: 'completed' } }),
      this.tenantRepository.count({ where: { isActive: true } }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      orders: {
        total: totalOrders,
        completed: completedOrders,
      },
      payments: {
        total: totalPayments,
        completed: completedPayments,
      },
      tenants: {
        total: totalTenants,
        active: activeTenants,
      },
    };
  }

  private async createAuditLog(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: any;
  }): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create(data);
      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
    }
  }
}
