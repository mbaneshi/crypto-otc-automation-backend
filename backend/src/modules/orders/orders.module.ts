import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { BinanceService } from '../../integrations/binance/binance.service';
import { LedgerService } from '../ledger/ledger.service';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, AuditLog, LedgerEntry])],
  controllers: [OrdersController],
  providers: [OrdersService, BinanceService, LedgerService],
  exports: [OrdersService],
})
export class OrdersModule {}
