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
import { Order } from './order.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  PAYID = 'payid',
  NPP = 'npp',
}

@Entity('payments')
@Index(['orderId'])
@Index(['status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 255, unique: true, name: 'npp_transaction_id', nullable: true })
  nppTransactionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'external_reference' })
  externalReference: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.NPP,
    name: 'payment_method',
  })
  paymentMethod: PaymentMethod;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'payer_name' })
  payerName: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'payer_account' })
  payerAccount: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'payee_name' })
  payeeName: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'payee_account' })
  payeeAccount: string;

  @Column({ type: 'text', nullable: true, name: 'failure_reason' })
  failureReason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    nppResponse?: any;
    bankDetails?: any;
    reconciliationData?: any;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date;
}
