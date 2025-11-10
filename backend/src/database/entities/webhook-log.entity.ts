import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookSource {
  BINANCE = 'binance',
  NPP = 'npp',
  SUMSUB = 'sumsub',
}

@Entity('webhook_logs')
@Index(['source'])
@Index(['eventType'])
@Index(['processed'])
@Index(['createdAt'])
export class WebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: WebhookSource,
  })
  source: WebhookSource;

  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'text', nullable: true })
  signature: string;

  @Column({ type: 'boolean', default: false })
  processed: boolean;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true, name: 'processed_at' })
  processedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
