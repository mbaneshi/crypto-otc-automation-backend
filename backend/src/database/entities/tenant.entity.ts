import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  subdomain: string;

  @Column({ type: 'varchar', length: 255, unique: true, name: 'api_key' })
  apiKey: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.ACTIVE,
  })
  status: TenantStatus;

  @Column({ type: 'jsonb', nullable: true })
  config: {
    branding?: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
    };
    fees?: {
      platformFeePercent: number;
      franchiseeFeePercent: number;
    };
    limits?: {
      minOrderAmount?: number;
      maxOrderAmount?: number;
      dailyLimit?: number;
    };
    binance?: {
      apiKey: string;
      apiSecret: string;
    };
    npp?: {
      merchantId: string;
      apiKey: string;
      apiSecret: string;
    };
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
