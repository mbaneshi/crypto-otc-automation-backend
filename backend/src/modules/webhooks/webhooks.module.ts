import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { BinanceWebhookHandler } from './handlers/binance-webhook.handler';
import { NPPWebhookHandler } from './handlers/npp-webhook.handler';
import { SumsubWebhookHandler } from './handlers/sumsub-webhook.handler';
import { Order } from '../../database/entities/order.entity';
import { Payment } from '../../database/entities/payment.entity';
import { User } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { WebhookLog } from '../../database/entities/webhook-log.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { BinanceService } from '../../integrations/binance/binance.service';
import { NPPService } from '../../integrations/npp/npp.service';
import { SumsubService } from '../../integrations/sumsub/sumsub.service';
import { LedgerService } from '../ledger/ledger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Payment, User, AuditLog, WebhookLog, LedgerEntry]),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    BinanceWebhookHandler,
    NPPWebhookHandler,
    SumsubWebhookHandler,
    BinanceService,
    NPPService,
    SumsubService,
    LedgerService,
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
