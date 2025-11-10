import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BinanceService } from '../../integrations/binance/binance.service';
import { NPPService } from '../../integrations/npp/npp.service';
import { SumsubService } from '../../integrations/sumsub/sumsub.service';
import { BinanceWebhookHandler } from './handlers/binance-webhook.handler';
import { NPPWebhookHandler } from './handlers/npp-webhook.handler';
import { SumsubWebhookHandler } from './handlers/sumsub-webhook.handler';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly binanceService: BinanceService,
    private readonly nppService: NPPService,
    private readonly sumsubService: SumsubService,
    private readonly binanceWebhookHandler: BinanceWebhookHandler,
    private readonly nppWebhookHandler: NPPWebhookHandler,
    private readonly sumsubWebhookHandler: SumsubWebhookHandler,
  ) {}

  async processBinanceWebhook(payload: any, signature: string): Promise<void> {
    const isValid = this.binanceService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const { eventType } = payload;

    this.logger.log(`Processing Binance webhook: ${eventType}`);

    switch (eventType) {
      case 'ORDER_MATCH':
        await this.binanceWebhookHandler.handleOrderMatch(payload);
        break;
      case 'PAYMENT_RECEIVED':
        await this.binanceWebhookHandler.handlePaymentReceived(payload);
        break;
      case 'ORDER_COMPLETED':
        await this.binanceWebhookHandler.handleOrderCompleted(payload);
        break;
      case 'ORDER_CANCELLED':
        await this.binanceWebhookHandler.handleOrderCancelled(payload);
        break;
      default:
        this.logger.warn(`Unknown Binance webhook event: ${eventType}`);
    }
  }

  async processNPPWebhook(payload: any, signature: string): Promise<void> {
    const isValid = this.nppService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const { eventType } = payload;

    this.logger.log(`Processing NPP webhook: ${eventType}`);

    switch (eventType) {
      case 'PAYMENT_STATUS_UPDATE':
        await this.nppWebhookHandler.handlePaymentStatus(payload);
        break;
      case 'REFUND_STATUS_UPDATE':
        await this.nppWebhookHandler.handleRefundStatus(payload);
        break;
      default:
        this.logger.warn(`Unknown NPP webhook event: ${eventType}`);
    }
  }

  async processSumsubWebhook(payload: any, signature: string): Promise<void> {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const isValid = this.sumsubService.verifyWebhookSignature(payloadString, signature);

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const { type } = data;

    this.logger.log(`Processing Sumsub webhook: ${type}`);

    switch (type) {
      case 'applicantReviewed':
        await this.sumsubWebhookHandler.handleApplicantReviewed(data);
        break;
      case 'applicantPending':
        await this.sumsubWebhookHandler.handleApplicantPending(data);
        break;
      case 'applicantCreated':
        await this.sumsubWebhookHandler.handleApplicantCreated(data);
        break;
      default:
        this.logger.warn(`Unknown Sumsub webhook event: ${type}`);
    }
  }
}
