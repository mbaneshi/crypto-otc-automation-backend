import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { User } from '../../database/entities/user.entity';
import Decimal from 'decimal.js';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getUserDashboard(userId: string): Promise<any> {
    const [orders, payments, user] = await Promise.all([
      this.orderRepository.find({ where: { userId } }),
      this.paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.order', 'order')
        .where('order.userId = :userId', { userId })
        .getMany(),
      this.userRepository.findOne({ where: { id: userId } }),
    ]);

    const orderStats = this.calculateOrderStats(orders);
    const paymentStats = this.calculatePaymentStats(payments);
    const volumeStats = this.calculateVolumeStats(orders);

    return {
      user: {
        email: user.email,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt,
      },
      orders: orderStats,
      payments: paymentStats,
      volume: volumeStats,
      recentOrders: orders
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5)
        .map((order) => ({
          id: order.id,
          type: order.type,
          cryptoAsset: order.cryptoAsset,
          cryptoAmount: order.cryptoAmount,
          fiatAmount: order.fiatAmount,
          status: order.status,
          createdAt: order.createdAt,
        })),
    };
  }

  async getAdminDashboard(): Promise<any> {
    const [totalUsers, totalOrders, totalPayments, recentOrders] = await Promise.all([
      this.userRepository.count(),
      this.orderRepository.count(),
      this.paymentRepository.count(),
      this.orderRepository.find({
        take: 10,
        order: { createdAt: 'DESC' },
        relations: ['user'],
      }),
    ]);

    const orders = await this.orderRepository.find();
    const payments = await this.paymentRepository.find();

    const orderStats = this.calculateOrderStats(orders);
    const paymentStats = this.calculatePaymentStats(payments);
    const volumeStats = this.calculateVolumeStats(orders);
    const userStats = await this.calculateUserStats();

    return {
      overview: {
        totalUsers,
        totalOrders,
        totalPayments,
        totalVolume: volumeStats.totalVolume,
      },
      orders: orderStats,
      payments: paymentStats,
      users: userStats,
      volume: volumeStats,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        userId: order.userId,
        userEmail: order.user?.email,
        type: order.type,
        cryptoAsset: order.cryptoAsset,
        fiatAmount: order.fiatAmount,
        status: order.status,
        createdAt: order.createdAt,
      })),
    };
  }

  async getOrderStats(userId?: string): Promise<any> {
    const query = this.orderRepository.createQueryBuilder('order');

    if (userId) {
      query.where('order.userId = :userId', { userId });
    }

    const orders = await query.getMany();

    return this.calculateOrderStats(orders);
  }

  async getPaymentStats(userId?: string): Promise<any> {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order');

    if (userId) {
      query.where('order.userId = :userId', { userId });
    }

    const payments = await query.getMany();

    return this.calculatePaymentStats(payments);
  }

  async getVolumeStats(startDate?: Date, endDate?: Date): Promise<any> {
    const query = this.orderRepository.createQueryBuilder('order');

    if (startDate && endDate) {
      query.where('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const orders = await query.getMany();

    return this.calculateVolumeStats(orders);
  }

  async getRevenue(startDate?: Date, endDate?: Date): Promise<any> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .where('order.status = :status', { status: OrderStatus.COMPLETED });

    if (startDate && endDate) {
      query.andWhere('order.completedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const orders = await query.getMany();

    const totalRevenue = orders.reduce(
      (sum, order) => sum.add(new Decimal(order.feeAmount)),
      new Decimal(0),
    );

    const revenueByAsset = orders.reduce((acc, order) => {
      if (!acc[order.cryptoAsset]) {
        acc[order.cryptoAsset] = new Decimal(0);
      }
      acc[order.cryptoAsset] = acc[order.cryptoAsset].add(new Decimal(order.feeAmount));
      return acc;
    }, {} as Record<string, Decimal>);

    return {
      totalRevenue: totalRevenue.toString(),
      ordersCount: orders.length,
      revenueByAsset: Object.entries(revenueByAsset).map(([asset, amount]) => ({
        asset,
        amount: amount.toString(),
      })),
    };
  }

  private calculateOrderStats(orders: Order[]): any {
    return {
      total: orders.length,
      pending: orders.filter((o) =>
        [
          OrderStatus.PENDING,
          OrderStatus.KYC_CHECK,
          OrderStatus.BINANCE_AD_CREATED,
          OrderStatus.MATCHED,
          OrderStatus.PAYMENT_PENDING,
          OrderStatus.PAYMENT_PROCESSING,
        ].includes(o.status),
      ).length,
      completed: orders.filter((o) => o.status === OrderStatus.COMPLETED).length,
      failed: orders.filter((o) => o.status === OrderStatus.FAILED).length,
      cancelled: orders.filter((o) => o.status === OrderStatus.CANCELLED).length,
      byType: {
        buy: orders.filter((o) => o.type === 'buy').length,
        sell: orders.filter((o) => o.type === 'sell').length,
      },
    };
  }

  private calculatePaymentStats(payments: Payment[]): any {
    return {
      total: payments.length,
      pending: payments.filter((p) => p.status === PaymentStatus.PENDING).length,
      processing: payments.filter((p) => p.status === PaymentStatus.PROCESSING).length,
      completed: payments.filter((p) => p.status === PaymentStatus.COMPLETED).length,
      failed: payments.filter((p) => p.status === PaymentStatus.FAILED).length,
      refunded: payments.filter((p) => p.status === PaymentStatus.REFUNDED).length,
      totalAmount: payments
        .filter((p) => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + parseFloat(p.amount), 0),
    };
  }

  private calculateVolumeStats(orders: Order[]): any {
    const completedOrders = orders.filter((o) => o.status === OrderStatus.COMPLETED);

    const totalVolume = completedOrders.reduce(
      (sum, o) => sum + parseFloat(o.fiatAmount),
      0,
    );

    const volumeByAsset = completedOrders.reduce((acc, order) => {
      if (!acc[order.cryptoAsset]) {
        acc[order.cryptoAsset] = { volume: 0, count: 0 };
      }
      acc[order.cryptoAsset].volume += parseFloat(order.fiatAmount);
      acc[order.cryptoAsset].count += 1;
      return acc;
    }, {} as Record<string, { volume: number; count: number }>);

    return {
      totalVolume,
      ordersCount: completedOrders.length,
      volumeByAsset,
    };
  }

  private async calculateUserStats(): Promise<any> {
    const users = await this.userRepository.find();

    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      kycApproved: users.filter((u) => u.kycStatus === 'approved').length,
      kycPending: users.filter((u) =>
        ['pending', 'in_review'].includes(u.kycStatus),
      ).length,
      kycRejected: users.filter((u) => u.kycStatus === 'rejected').length,
      byRole: {
        admin: users.filter((u) => u.role === 'admin').length,
        operator: users.filter((u) => u.role === 'operator').length,
        customer: users.filter((u) => u.role === 'customer').length,
      },
    };
  }
}
