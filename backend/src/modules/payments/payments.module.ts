import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from '../../database/entities/payment.entity';
import { Order } from '../../database/entities/order.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { NPPService } from '../../integrations/npp/npp.service';
import { LedgerService } from '../ledger/ledger.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Order, AuditLog, LedgerEntry])],
  controllers: [PaymentsController],
  providers: [PaymentsService, NPPService, LedgerService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
