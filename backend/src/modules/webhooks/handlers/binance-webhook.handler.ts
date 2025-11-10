import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../../../database/entities/order.entity';
import { WebhookLog } from '../../../database/entities/webhook-log.entity';

@Injectable()
export class BinanceWebhookHandler {
  private readonly logger = new Logger(BinanceWebhookHandler.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
  ) {}

  async handleOrderMatch(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing Binance order match webhook: ${payload.orderNumber}`);

      await this.logWebhook('binance', 'order_match', payload, 'success');

      const order = await this.orderRepository.findOne({
        where: { binanceOrderId: payload.orderNumber },
      });

      if (!order) {
        this.logger.warn(`Order not found for Binance order: ${payload.orderNumber}`);
        return;
      }

      order.status = OrderStatus.MATCHED;
      order.metadata = {
        ...order.metadata,
        binanceOrderDetails: payload,
      };

      await this.orderRepository.save(order);

      this.logger.log(`Order ${order.id} marked as matched`);
    } catch (error) {
      this.logger.error(`Failed to handle Binance order match: ${error.message}`, error.stack);
      await this.logWebhook('binance', 'order_match', payload, 'failed', error.message);
      throw error;
    }
  }

  async handlePaymentReceived(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing Binance payment received webhook: ${payload.orderNumber}`);

      await this.logWebhook('binance', 'payment_received', payload, 'success');

      const order = await this.orderRepository.findOne({
        where: { binanceOrderId: payload.orderNumber },
      });

      if (!order) {
        this.logger.warn(`Order not found for Binance order: ${payload.orderNumber}`);
        return;
      }

      order.status = OrderStatus.PAYMENT_COMPLETED;
      order.metadata = {
        ...order.metadata,
        paymentDetails: payload,
      };

      await this.orderRepository.save(order);

      this.logger.log(`Payment received for order ${order.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle Binance payment: ${error.message}`, error.stack);
      await this.logWebhook('binance', 'payment_received', payload, 'failed', error.message);
      throw error;
    }
  }

  async handleOrderCompleted(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing Binance order completed webhook: ${payload.orderNumber}`);

      await this.logWebhook('binance', 'order_completed', payload, 'success');

      const order = await this.orderRepository.findOne({
        where: { binanceOrderId: payload.orderNumber },
      });

      if (!order) {
        this.logger.warn(`Order not found for Binance order: ${payload.orderNumber}`);
        return;
      }

      order.status = OrderStatus.COMPLETED;
      order.completedAt = new Date();
      order.metadata = {
        ...order.metadata,
        completionDetails: payload,
      };

      await this.orderRepository.save(order);

      this.logger.log(`Order ${order.id} completed`);
    } catch (error) {
      this.logger.error(`Failed to handle Binance completion: ${error.message}`, error.stack);
      await this.logWebhook('binance', 'order_completed', payload, 'failed', error.message);
      throw error;
    }
  }

  async handleOrderCancelled(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing Binance order cancelled webhook: ${payload.orderNumber}`);

      await this.logWebhook('binance', 'order_cancelled', payload, 'success');

      const order = await this.orderRepository.findOne({
        where: { binanceOrderId: payload.orderNumber },
      });

      if (!order) {
        this.logger.warn(`Order not found for Binance order: ${payload.orderNumber}`);
        return;
      }

      order.status = OrderStatus.CANCELLED;
      order.failureReason = payload.reason || 'Cancelled on Binance';
      order.metadata = {
        ...order.metadata,
        cancellationDetails: payload,
      };

      await this.orderRepository.save(order);

      this.logger.log(`Order ${order.id} cancelled`);
    } catch (error) {
      this.logger.error(`Failed to handle Binance cancellation: ${error.message}`, error.stack);
      await this.logWebhook('binance', 'order_cancelled', payload, 'failed', error.message);
      throw error;
    }
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
