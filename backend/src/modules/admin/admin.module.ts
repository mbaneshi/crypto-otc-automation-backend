import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../../database/entities/user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { Order } from '../../database/entities/order.entity';
import { Payment } from '../../database/entities/payment.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Reconciliation } from '../../database/entities/reconciliation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, Order, Payment, AuditLog, Reconciliation]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
