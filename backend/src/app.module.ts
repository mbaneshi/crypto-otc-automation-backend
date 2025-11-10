import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';

// Configuration
import databaseConfig from './config/database.config';
import binanceConfig from './config/binance.config';
import nppConfig from './config/npp.config';
import sumsubConfig from './config/sumsub.config';

// Entities
import * as entities from './database/entities';

// Common
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';

// Integration Services
import { BinanceService } from './integrations/binance/binance.service';
import { NPPService } from './integrations/npp/npp.service';
import { SumsubService } from './integrations/sumsub/sumsub.service';

// Core Services
import { LedgerService } from './modules/ledger/ledger.service';

// Jobs
import { ReconciliationJob } from './jobs/reconciliation.job';

// Application Modules
import { AuthModule } from './modules/auth/auth.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { KycModule } from './modules/kyc/kyc.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AdminModule } from './modules/admin/admin.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, binanceConfig, nppConfig, sumsubConfig],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
      inject: [ConfigService],
    }),

    // TypeORM repositories
    TypeOrmModule.forFeature(Object.values(entities)),

    // Scheduling
    ScheduleModule.forRoot(),

    // Bull Queue (for async jobs)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB') || 0,
        },
      }),
      inject: [ConfigService],
    }),

    // Application Modules
    AuthModule,
    OrdersModule,
    PaymentsModule,
    KycModule,
    WebhooksModule,
    DashboardModule,
    AdminModule,
  ],
  providers: [
    // Interceptors
    TenantInterceptor,

    // Integration Services
    BinanceService,
    NPPService,
    SumsubService,

    // Core Services
    LedgerService,

    // Jobs
    ReconciliationJob,
  ],
})
export class AppModule {}
