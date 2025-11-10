import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Order } from './order.entity';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

@Entity('ledger_entries')
@Index(['account'])
@Index(['orderId'])
@Index(['createdAt'])
@Check(`("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)`)
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  account: string; // e.g., 'asset:bank', 'liability:customer', 'revenue:fees'

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  debit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  credit: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'uuid', nullable: true, name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'reference_type' })
  referenceType: string; // 'order', 'payment', 'refund', 'fee', 'commission'

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    transactionType?: string;
    originalAmount?: string;
    exchangeRate?: string;
    reconciliationId?: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
