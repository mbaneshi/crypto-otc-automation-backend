import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, Reconciliation, ReconciliationStatus } from '../database/entities';
import { BinanceService } from '../integrations/binance/binance.service';
import { NPPService } from '../integrations/npp/npp.service';
import { LedgerService } from '../modules/ledger/ledger.service';
import Decimal from 'decimal.js';

interface DiscrepancyInfo {
  type: string;
  account: string;
  currency: string;
  expected: string;
  actual: string;
  difference: string;
}

@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Reconciliation)
    private readonly reconciliationRepository: Repository<Reconciliation>,
    private readonly binanceService: BinanceService,
    private readonly nppService: NPPService,
    private readonly ledgerService: LedgerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runDailyReconciliation(): Promise<void> {
    this.logger.log('Starting daily reconciliation job');

    try {
      const tenants = await this.tenantRepository.find({
        where: { status: 'active' },
      });

      this.logger.log(`Found ${tenants.length} active tenants to reconcile`);

      for (const tenant of tenants) {
        try {
          await this.reconcileTenant(tenant);
        } catch (error) {
          this.logger.error(
            `Failed to reconcile tenant ${tenant.id}: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log('Daily reconciliation job completed');
    } catch (error) {
      this.logger.error(`Reconciliation job failed: ${error.message}`, error.stack);
    }
  }

  async reconcileTenant(tenant: Tenant): Promise<Reconciliation> {
    this.logger.log(`Reconciling tenant: ${tenant.name} (${tenant.id})`);

    try {
      // 1. Get Binance balances
      const binanceBalances = await this.getBinanceBalances(tenant);
      this.logger.log(`Binance balances: ${JSON.stringify(binanceBalances)}`);

      // 2. Get NPP balances
      const nppBalances = await this.getNPPBalances(tenant);
      this.logger.log(`NPP balances: ${JSON.stringify(nppBalances)}`);

      // 3. Get Ledger balances
      const ledgerBalances = await this.getLedgerBalances();
      this.logger.log(`Ledger balances: ${JSON.stringify(ledgerBalances)}`);

      // 4. Compare and find discrepancies
      const discrepancies = this.compareBalances(
        binanceBalances,
        nppBalances,
        ledgerBalances,
      );

      // 5. Determine status
      const status =
        discrepancies.length > 0
          ? ReconciliationStatus.DISCREPANCY_FOUND
          : ReconciliationStatus.MATCHED;

      // 6. Create reconciliation record
      const reconciliation = this.reconciliationRepository.create({
        date: new Date(),
        binanceBalances,
        nppBalances,
        ledgerBalances,
        discrepancies,
        status,
      });

      await this.reconciliationRepository.save(reconciliation);

      // 7. Send alerts if discrepancies found
      if (discrepancies.length > 0) {
        await this.sendDiscrepancyAlert(tenant, discrepancies);
      }

      this.logger.log(
        `Reconciliation completed for tenant ${tenant.name}: ${status}`,
      );

      return reconciliation;
    } catch (error) {
      this.logger.error(
        `Failed to reconcile tenant ${tenant.name}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async getBinanceBalances(tenant: Tenant): Promise<{ [asset: string]: string }> {
    try {
      // In production, use tenant-specific Binance credentials
      return await this.binanceService.getAccountBalance();
    } catch (error) {
      this.logger.error(`Failed to get Binance balances: ${error.message}`);
      return {};
    }
  }

  private async getNPPBalances(tenant: Tenant): Promise<{ [currency: string]: string }> {
    try {
      // In production, use tenant-specific NPP credentials
      return await this.nppService.getAccountBalance();
    } catch (error) {
      this.logger.error(`Failed to get NPP balances: ${error.message}`);
      return {};
    }
  }

  private async getLedgerBalances(): Promise<{
    [account: string]: { [currency: string]: string };
  }> {
    try {
      const accountBalances = await this.ledgerService.getAllAccountBalances();

      const grouped: { [account: string]: { [currency: string]: string } } = {};

      for (const balance of accountBalances) {
        if (!grouped[balance.account]) {
          grouped[balance.account] = {};
        }
        grouped[balance.account][balance.currency] = balance.balance;
      }

      return grouped;
    } catch (error) {
      this.logger.error(`Failed to get ledger balances: ${error.message}`);
      return {};
    }
  }

  private compareBalances(
    binanceBalances: { [asset: string]: string },
    nppBalances: { [currency: string]: string },
    ledgerBalances: { [account: string]: { [currency: string]: string } },
  ): DiscrepancyInfo[] {
    const discrepancies: DiscrepancyInfo[] = [];

    // Compare Binance balances with ledger crypto assets
    for (const [asset, binanceAmount] of Object.entries(binanceBalances)) {
      const ledgerAmount = ledgerBalances['asset:crypto']?.[asset] || '0';
      const binanceDecimal = new Decimal(binanceAmount);
      const ledgerDecimal = new Decimal(ledgerAmount);

      if (!binanceDecimal.equals(ledgerDecimal)) {
        const difference = binanceDecimal.minus(ledgerDecimal);
        discrepancies.push({
          type: 'crypto_balance',
          account: 'asset:crypto',
          currency: asset,
          expected: ledgerAmount,
          actual: binanceAmount,
          difference: difference.toString(),
        });
      }
    }

    // Compare NPP balances with ledger bank assets
    for (const [currency, nppAmount] of Object.entries(nppBalances)) {
      const ledgerAmount = ledgerBalances['asset:bank']?.[currency] || '0';
      const nppDecimal = new Decimal(nppAmount);
      const ledgerDecimal = new Decimal(ledgerAmount);

      // Allow small differences due to rounding (within 0.01)
      const difference = nppDecimal.minus(ledgerDecimal);
      if (difference.abs().greaterThan(0.01)) {
        discrepancies.push({
          type: 'fiat_balance',
          account: 'asset:bank',
          currency,
          expected: ledgerAmount,
          actual: nppAmount,
          difference: difference.toString(),
        });
      }
    }

    return discrepancies;
  }

  private async sendDiscrepancyAlert(
    tenant: Tenant,
    discrepancies: DiscrepancyInfo[],
  ): Promise<void> {
    // In production, send email/SMS alerts
    this.logger.warn(
      `Discrepancies found for tenant ${tenant.name}: ${JSON.stringify(discrepancies)}`,
    );

    // TODO: Implement email/SMS alerting
    // await this.emailService.sendAlert({
    //   to: tenant.config.alertEmail,
    //   subject: 'Reconciliation Discrepancy Alert',
    //   body: `Discrepancies found: ${JSON.stringify(discrepancies, null, 2)}`,
    // });
  }
}
