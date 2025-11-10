import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from '../../database/entities/payment.entity';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { NPPService } from '../../integrations/npp/npp.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly nppService: NPPService,
    private readonly ledgerService: LedgerService,
  ) {}

  async create(userId: string, createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const order = await this.orderRepository.findOne({
      where: { id: createPaymentDto.orderId, userId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.BINANCE_AD_CREATED && order.status !== OrderStatus.MATCHED) {
      throw new BadRequestException(`Cannot create payment for order with status: ${order.status}`);
    }

    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId: order.id, status: PaymentStatus.PENDING },
    });

    if (existingPayment) {
      throw new BadRequestException('A pending payment already exists for this order');
    }

    const payment = this.paymentRepository.create({
      orderId: order.id,
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      paymentMethod: createPaymentDto.paymentMethod,
      status: PaymentStatus.PENDING,
      metadata: createPaymentDto.metadata || {},
    });

    await this.paymentRepository.save(payment);

    order.status = OrderStatus.PAYMENT_PENDING;
    order.nppPaymentId = payment.id;
    await this.orderRepository.save(order);

    await this.createAuditLog({
      userId,
      action: 'PAYMENT_CREATED',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { orderId: order.id, amount: payment.amount },
    });

    this.logger.log(`Payment created: ${payment.id} for order ${order.id}`);

    if (payment.paymentMethod === PaymentMethod.NPP) {
      try {
        await this.initiateNPPPayment(payment, order);
      } catch (error) {
        this.logger.error(`Failed to initiate NPP payment: ${error.message}`);
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = error.message;
        await this.paymentRepository.save(payment);
      }
    }

    return payment;
  }

  async findAll(userId: string, filters?: { status?: PaymentStatus }): Promise<Payment[]> {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .where('order.userId = :userId', { userId });

    if (filters?.status) {
      query.andWhere('payment.status = :status', { status: filters.status });
    }

    query.orderBy('payment.createdAt', 'DESC');

    return query.getMany();
  }

  async findOne(id: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.order.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async processPaymentWebhook(transactionId: string, status: string, metadata: any): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { nppTransactionId: transactionId },
      relations: ['order'],
    });

    if (!payment) {
      this.logger.warn(`Payment not found for NPP transaction: ${transactionId}`);
      return;
    }

    const previousStatus = payment.status;

    switch (status) {
      case 'completed':
        payment.status = PaymentStatus.COMPLETED;
        payment.completedAt = new Date();
        payment.metadata = { ...payment.metadata, nppResponse: metadata };

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

        this.logger.log(`Payment completed: ${payment.id}`);
        break;

      case 'failed':
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = metadata.failureReason || 'Payment failed';
        payment.order.status = OrderStatus.FAILED;
        payment.order.failureReason = payment.failureReason;
        await this.orderRepository.save(payment.order);

        this.logger.log(`Payment failed: ${payment.id}`);
        break;

      case 'processing':
        payment.status = PaymentStatus.PROCESSING;
        payment.order.status = OrderStatus.PAYMENT_PROCESSING;
        await this.orderRepository.save(payment.order);
        break;

      default:
        this.logger.warn(`Unknown payment status: ${status}`);
        return;
    }

    await this.paymentRepository.save(payment);

    await this.createAuditLog({
      userId: payment.order.userId,
      action: 'PAYMENT_STATUS_UPDATED',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { previousStatus, newStatus: payment.status, transactionId },
    });
  }

  async refundPayment(id: string, userId: string, reason: string): Promise<Payment> {
    const payment = await this.findOne(id, userId);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    if (!payment.nppTransactionId) {
      throw new BadRequestException('Cannot refund payment without NPP transaction ID');
    }

    try {
      await this.nppService.refundPayment(payment.nppTransactionId, payment.amount, reason);

      payment.status = PaymentStatus.REFUNDED;
      payment.failureReason = reason;
      await this.paymentRepository.save(payment);

      payment.order.status = OrderStatus.REFUNDED;
      payment.order.failureReason = reason;
      await this.orderRepository.save(payment.order);

      await this.ledgerService.recordTransaction({
        userId: payment.order.userId,
        transactionType: 'PAYMENT_REFUNDED',
        amount: `-${payment.amount}`,
        currency: payment.currency,
        referenceType: 'Payment',
        referenceId: payment.id,
        description: `Payment refunded: ${reason}`,
      });

      await this.createAuditLog({
        userId,
        action: 'PAYMENT_REFUNDED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: { reason },
      });

      this.logger.log(`Payment refunded: ${payment.id}`);

      return payment;
    } catch (error) {
      this.logger.error(`Failed to refund payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPaymentStats(userId: string): Promise<any> {
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .where('order.userId = :userId', { userId })
      .getMany();

    const stats = {
      total: payments.length,
      completed: payments.filter((p) => p.status === PaymentStatus.COMPLETED).length,
      pending: payments.filter((p) => p.status === PaymentStatus.PENDING).length,
      processing: payments.filter((p) => p.status === PaymentStatus.PROCESSING).length,
      failed: payments.filter((p) => p.status === PaymentStatus.FAILED).length,
      refunded: payments.filter((p) => p.status === PaymentStatus.REFUNDED).length,
      totalAmount: payments
        .filter((p) => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + parseFloat(p.amount), 0),
    };

    return stats;
  }

  private async initiateNPPPayment(payment: Payment, order: Order): Promise<void> {
    try {
      const paymentParams = {
        amount: payment.amount,
        currency: payment.currency,
        payerAccount: order.metadata?.customerBankDetails?.accountNumber || '',
        payerBsb: order.metadata?.customerBankDetails?.bsb || '',
        payeeName: 'OTC Platform',
        payeeAccount: '12345678',
        payeeBsb: '123456',
        reference: `ORDER-${order.id}`,
        description: `Payment for order ${order.id}`,
      };

      const nppResponse = await this.nppService.initiatePayment(paymentParams);

      payment.nppTransactionId = nppResponse.transactionId;
      payment.status = PaymentStatus.PROCESSING;
      payment.metadata = {
        ...payment.metadata,
        nppResponse,
      };

      await this.paymentRepository.save(payment);

      order.status = OrderStatus.PAYMENT_PROCESSING;
      await this.orderRepository.save(order);

      this.logger.log(`NPP payment initiated: ${nppResponse.transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to initiate NPP payment: ${error.message}`, error.stack);
      throw error;
    }
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
