import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, OrderType } from '../../database/entities/order.entity';
import { User, KycStatus } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { BinanceService } from '../../integrations/binance/binance.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import Decimal from 'decimal.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly binanceService: BinanceService,
    private readonly ledgerService: LedgerService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus !== KycStatus.APPROVED) {
      throw new ForbiddenException('KYC verification required to create orders');
    }

    const feePercent = new Decimal(createOrderDto.type === OrderType.BUY ? 1.5 : 1.0);
    const feeAmount = new Decimal(createOrderDto.fiatAmount)
      .mul(feePercent)
      .div(100)
      .toFixed(2);

    const order = this.orderRepository.create({
      userId,
      type: createOrderDto.type,
      cryptoAsset: createOrderDto.cryptoAsset,
      fiatCurrency: createOrderDto.fiatCurrency,
      cryptoAmount: createOrderDto.cryptoAmount,
      fiatAmount: createOrderDto.fiatAmount,
      price: createOrderDto.price,
      feePercent: feePercent.toString(),
      feeAmount,
      status: OrderStatus.KYC_CHECK,
      metadata: createOrderDto.metadata || {},
    });

    await this.orderRepository.save(order);

    await this.createAuditLog({
      userId,
      action: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: order.id,
      metadata: { type: order.type, cryptoAsset: order.cryptoAsset, fiatAmount: order.fiatAmount },
    });

    this.logger.log(`Order created: ${order.id} for user ${userId}`);

    try {
      await this.createBinanceAd(order);
    } catch (error) {
      this.logger.error(`Failed to create Binance ad for order ${order.id}: ${error.message}`);
      order.status = OrderStatus.FAILED;
      order.failureReason = `Failed to create Binance ad: ${error.message}`;
      await this.orderRepository.save(order);
    }

    return order;
  }

  async findAll(userId: string, filters?: { status?: OrderStatus; type?: OrderType }): Promise<Order[]> {
    const query = this.orderRepository.createQueryBuilder('order').where('order.userId = :userId', { userId });

    if (filters?.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters?.type) {
      query.andWhere('order.type = :type', { type: filters.type });
    }

    query.orderBy('order.createdAt', 'DESC');

    return query.getMany();
  }

  async findOne(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async update(id: string, userId: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (updateOrderDto.status) {
      order.status = updateOrderDto.status;
    }

    if (updateOrderDto.failureReason) {
      order.failureReason = updateOrderDto.failureReason;
    }

    if (order.status === OrderStatus.COMPLETED) {
      order.completedAt = new Date();
    }

    await this.orderRepository.save(order);

    await this.createAuditLog({
      userId,
      action: 'ORDER_UPDATED',
      entityType: 'Order',
      entityId: order.id,
      metadata: { status: order.status },
    });

    this.logger.log(`Order updated: ${order.id}`);

    return order;
  }

  async cancel(id: string, userId: string, reason?: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED].includes(order.status)) {
      throw new BadRequestException(`Cannot cancel order with status: ${order.status}`);
    }

    order.status = OrderStatus.CANCELLED;
    order.failureReason = reason || 'Cancelled by user';
    await this.orderRepository.save(order);

    if (order.binanceAdId) {
      try {
        await this.binanceService.deleteP2PAd(order.binanceAdId);
      } catch (error) {
        this.logger.error(`Failed to delete Binance ad: ${error.message}`);
      }
    }

    await this.createAuditLog({
      userId,
      action: 'ORDER_CANCELLED',
      entityType: 'Order',
      entityId: order.id,
      metadata: { reason: order.failureReason },
    });

    this.logger.log(`Order cancelled: ${order.id}`);

    return order;
  }

  async processOrderPayment(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PAYMENT_COMPLETED) {
      throw new BadRequestException('Payment not completed');
    }

    order.status = OrderStatus.PROCESSING;
    await this.orderRepository.save(order);

    if (order.type === OrderType.BUY) {
      await this.ledgerService.recordTransaction({
        userId: order.userId,
        transactionType: 'CRYPTO_PURCHASE',
        amount: order.cryptoAmount,
        currency: order.cryptoAsset,
        referenceType: 'Order',
        referenceId: order.id,
        description: `Purchase ${order.cryptoAmount} ${order.cryptoAsset}`,
      });
    } else {
      await this.ledgerService.recordTransaction({
        userId: order.userId,
        transactionType: 'CRYPTO_SALE',
        amount: order.fiatAmount,
        currency: order.fiatCurrency,
        referenceType: 'Order',
        referenceId: order.id,
        description: `Sale of ${order.cryptoAmount} ${order.cryptoAsset}`,
      });
    }

    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    await this.orderRepository.save(order);

    await this.createAuditLog({
      userId: order.userId,
      action: 'ORDER_COMPLETED',
      entityType: 'Order',
      entityId: order.id,
      metadata: { status: order.status },
    });

    this.logger.log(`Order processed and completed: ${order.id}`);
  }

  async getOrderStats(userId: string): Promise<any> {
    const orders = await this.orderRepository.find({ where: { userId } });

    const stats = {
      total: orders.length,
      completed: orders.filter((o) => o.status === OrderStatus.COMPLETED).length,
      pending: orders.filter((o) =>
        [OrderStatus.PENDING, OrderStatus.KYC_CHECK, OrderStatus.PAYMENT_PENDING, OrderStatus.PROCESSING].includes(
          o.status,
        ),
      ).length,
      cancelled: orders.filter((o) => o.status === OrderStatus.CANCELLED).length,
      failed: orders.filter((o) => o.status === OrderStatus.FAILED).length,
      totalVolume: orders
        .filter((o) => o.status === OrderStatus.COMPLETED)
        .reduce((sum, o) => sum + parseFloat(o.fiatAmount), 0),
    };

    return stats;
  }

  private async createBinanceAd(order: Order): Promise<void> {
    try {
      const minAmount = new Decimal(order.fiatAmount).mul(0.5).toFixed(2);
      const maxAmount = order.fiatAmount;

      const adParams = {
        asset: order.cryptoAsset,
        fiatUnit: order.fiatCurrency,
        tradeType: order.type === OrderType.BUY ? ('BUY' as const) : ('SELL' as const),
        price: order.price,
        totalAmount: order.cryptoAmount,
        minSingleTransAmount: minAmount,
        maxSingleTransAmount: maxAmount,
        payTypes: ['BANK'],
      };

      const adResponse = await this.binanceService.createP2PAd(adParams);

      order.binanceAdId = adResponse.advNo;
      order.status = OrderStatus.BINANCE_AD_CREATED;
      order.metadata = {
        ...order.metadata,
        binanceOrderDetails: adResponse,
      };

      await this.orderRepository.save(order);

      this.logger.log(`Binance ad created for order ${order.id}: ${adResponse.advNo}`);
    } catch (error) {
      this.logger.error(`Failed to create Binance ad: ${error.message}`, error.stack);
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
