import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ReconciliationStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  DISCREPANCY_FOUND = 'discrepancy_found',
  RESOLVED = 'resolved',
}

@Entity('reconciliations')
@Index(['date'])
@Index(['status'])
export class Reconciliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'jsonb', nullable: true, name: 'binance_balances' })
  binanceBalances: {
    [asset: string]: string; // e.g., { "BTC": "1.5", "USDT": "10000" }
  };

  @Column({ type: 'jsonb', nullable: true, name: 'npp_balances' })
  nppBalances: {
    [currency: string]: string; // e.g., { "AUD": "15000.00" }
  };

  @Column({ type: 'jsonb', nullable: true, name: 'ledger_balances' })
  ledgerBalances: {
    [account: string]: {
      [currency: string]: string;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  discrepancies: Array<{
    type: string;
    account: string;
    currency: string;
    expected: string;
    actual: string;
    difference: string;
  }>;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.PENDING,
  })
  status: ReconciliationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'uuid', nullable: true, name: 'resolved_by' })
  resolvedBy: string;

  @Column({ type: 'timestamp', nullable: true, name: 'resolved_at' })
  resolvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
