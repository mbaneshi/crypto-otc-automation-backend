import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum OrderType {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderStatus {
  PENDING = 'pending',
  KYC_CHECK = 'kyc_check',
  BINANCE_AD_CREATED = 'binance_ad_created',
  MATCHED = 'matched',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_PROCESSING = 'payment_processing',
  PAYMENT_COMPLETED = 'payment_completed',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('orders')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'binance_order_id' })
  binanceOrderId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'binance_ad_id' })
  binanceAdId: string;

  @Column({
    type: 'enum',
    enum: OrderType,
  })
  type: OrderType;

  @Column({ type: 'varchar', length: 10, name: 'crypto_asset' })
  cryptoAsset: string;

  @Column({ type: 'varchar', length: 10, name: 'fiat_currency' })
  fiatCurrency: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, name: 'crypto_amount' })
  cryptoAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'fiat_amount' })
  fiatAmount: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  price: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'fee_amount' })
  feeAmount: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'fee_percent' })
  feePercent: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'npp_payment_id' })
  nppPaymentId: string;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    customerPaymentMethod?: string;
    customerBankDetails?: any;
    binanceOrderDetails?: any;
    paymentDetails?: any;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date;
}
