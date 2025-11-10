import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../../../database/entities/payment.entity';
import { Order, OrderStatus } from '../../../database/entities/order.entity';
import { WebhookLog } from '../../../database/entities/webhook-log.entity';
import { LedgerService } from '../../ledger/ledger.service';

@Injectable()
export class NPPWebhookHandler {
  private readonly logger = new Logger(NPPWebhookHandler.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
    private readonly ledgerService: LedgerService,
  ) {}

  async handlePaymentStatus(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing NPP payment status webhook: ${payload.transactionId}`);

      await this.logWebhook('npp', 'payment_status', payload, 'success');

      const payment = await this.paymentRepository.findOne({
        where: { nppTransactionId: payload.transactionId },
        relations: ['order'],
      });

      if (!payment) {
        this.logger.warn(`Payment not found for NPP transaction: ${payload.transactionId}`);
        return;
      }

      const previousStatus = payment.status;

      switch (payload.status) {
        case 'completed':
          await this.handlePaymentCompleted(payment, payload);
          break;
        case 'failed':
          await this.handlePaymentFailed(payment, payload);
          break;
        case 'processing':
          await this.handlePaymentProcessing(payment, payload);
          break;
        default:
          this.logger.warn(`Unknown payment status: ${payload.status}`);
      }

      this.logger.log(
        `Payment ${payment.id} status updated: ${previousStatus} -> ${payment.status}`,
      );
    } catch (error) {
      this.logger.error(`Failed to handle NPP payment status: ${error.message}`, error.stack);
      await this.logWebhook('npp', 'payment_status', payload, 'failed', error.message);
      throw error;
    }
  }

  async handleRefundStatus(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing NPP refund status webhook: ${payload.transactionId}`);

      await this.logWebhook('npp', 'refund_status', payload, 'success');

      const payment = await this.paymentRepository.findOne({
        where: { nppTransactionId: payload.transactionId },
        relations: ['order'],
      });

      if (!payment) {
        this.logger.warn(`Payment not found for NPP transaction: ${payload.transactionId}`);
        return;
      }

      if (payload.status === 'completed') {
        payment.status = PaymentStatus.REFUNDED;
        payment.metadata = {
          ...payment.metadata,
          refundDetails: payload,
        };

        await this.paymentRepository.save(payment);

        payment.order.status = OrderStatus.REFUNDED;
        await this.orderRepository.save(payment.order);

        await this.ledgerService.recordTransaction({
          userId: payment.order.userId,
          transactionType: 'PAYMENT_REFUNDED',
          amount: `-${payment.amount}`,
          currency: payment.currency,
          referenceType: 'Payment',
          referenceId: payment.id,
          description: `Payment refunded for order ${payment.order.id}`,
        });

        this.logger.log(`Payment ${payment.id} refunded successfully`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle NPP refund status: ${error.message}`, error.stack);
      await this.logWebhook('npp', 'refund_status', payload, 'failed', error.message);
      throw error;
    }
  }

  private async handlePaymentCompleted(payment: Payment, payload: any): Promise<void> {
    payment.status = PaymentStatus.COMPLETED;
    payment.completedAt = new Date();
    payment.payerName = payload.payerName;
    payment.payerAccount = payload.payerAccount;
    payment.metadata = {
      ...payment.metadata,
      nppResponse: payload,
    };

    await this.paymentRepository.save(payment);

    payment.order.status = OrderStatus.PAYMENT_COMPLETED;
    await this.orderRepository.save(payment.order);

    await this.ledgerService.recordTransaction({
      userId: payment.order.userId,
      transactionType: 'PAYMENT_RECEIVED',
      amount: payment.amount,
      currency: payment.currency,
      referenceType: 'Payment',
      referenceId: payment.id,
      description: `Payment received for order ${payment.order.id}`,
    });

    this.logger.log(`Payment ${payment.id} completed successfully`);
  }

  private async handlePaymentFailed(payment: Payment, payload: any): Promise<void> {
    payment.status = PaymentStatus.FAILED;
    payment.failureReason = payload.failureReason || 'Payment failed';
    payment.metadata = {
      ...payment.metadata,
      failureDetails: payload,
    };

    await this.paymentRepository.save(payment);

    payment.order.status = OrderStatus.FAILED;
    payment.order.failureReason = payment.failureReason;
    await this.orderRepository.save(payment.order);

    this.logger.log(`Payment ${payment.id} failed: ${payment.failureReason}`);
  }

  private async handlePaymentProcessing(payment: Payment, payload: any): Promise<void> {
    payment.status = PaymentStatus.PROCESSING;
    payment.metadata = {
      ...payment.metadata,
      processingDetails: payload,
    };

    await this.paymentRepository.save(payment);

    payment.order.status = OrderStatus.PAYMENT_PROCESSING;
    await this.orderRepository.save(payment.order);

    this.logger.log(`Payment ${payment.id} is being processed`);
  }

  private async logWebhook(
    source: string,
    event: string,
    payload: any,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const webhookLog = this.webhookLogRepository.create({
        source,
        event,
        payload,
        status,
        errorMessage,
      });

      await this.webhookLogRepository.save(webhookLog);
    } catch (error) {
      this.logger.error(`Failed to log webhook: ${error.message}`);
    }
  }
}
