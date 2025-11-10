import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LedgerEntry } from '../../database/entities';
import Decimal from 'decimal.js';

export interface CreateLedgerEntryDto {
  account: string;
  debit: string;
  credit: string;
  currency: string;
  orderId?: string;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: any;
}

export interface TransactionEntry {
  account: string;
  amount: string;
  type: 'debit' | 'credit';
  currency: string;
  description?: string;
}

export interface AccountBalance {
  account: string;
  currency: string;
  balance: string;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async recordTransaction(
    entries: TransactionEntry[],
    orderId?: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<LedgerEntry[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Recording transaction with ${entries.length} entries`);

      // Validate double-entry: total debits must equal total credits
      const validation = this.validateDoubleEntry(entries);
      if (!validation.valid) {
        throw new Error(`Invalid double-entry transaction: ${validation.error}`);
      }

      // Create ledger entries
      const ledgerEntries: LedgerEntry[] = [];

      for (const entry of entries) {
        const ledgerEntry = this.ledgerRepository.create({
          account: entry.account,
          debit: entry.type === 'debit' ? entry.amount : '0',
          credit: entry.type === 'credit' ? entry.amount : '0',
          currency: entry.currency,
          orderId,
          referenceType,
          referenceId,
          description: entry.description,
        });

        const savedEntry = await queryRunner.manager.save(ledgerEntry);
        ledgerEntries.push(savedEntry);
      }

      // Verify overall ledger balance
      await this.verifyLedgerBalance(queryRunner);

      await queryRunner.commitTransaction();

      this.logger.log(`Transaction recorded successfully with ${ledgerEntries.length} entries`);
      return ledgerEntries;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to record transaction: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async recordOrderPayment(
    orderId: string,
    amount: string,
    currency: string,
    feeAmount: string,
  ): Promise<LedgerEntry[]> {
    const entries: TransactionEntry[] = [
      // Debit: Increase bank asset (received payment)
      {
        account: 'asset:bank',
        amount,
        type: 'debit',
        currency,
        description: `Payment received for order ${orderId}`,
      },
      // Credit: Decrease customer liability (they paid us)
      {
        account: 'liability:customer',
        amount,
        type: 'credit',
        currency,
        description: `Customer payment for order ${orderId}`,
      },
    ];

    // Record fee if applicable
    if (parseFloat(feeAmount) > 0) {
      entries.push(
        // Debit: Fee revenue
        {
          account: 'revenue:fees',
          amount: feeAmount,
          type: 'debit',
          currency,
          description: `Fee for order ${orderId}`,
        },
        // Credit: Reduce bank asset by fee amount
        {
          account: 'asset:bank',
          amount: feeAmount,
          type: 'credit',
          currency,
          description: `Fee deduction for order ${orderId}`,
        },
      );
    }

    return await this.recordTransaction(entries, orderId, 'order_payment', orderId);
  }

  async recordCryptoRelease(
    orderId: string,
    cryptoAmount: string,
    cryptoAsset: string,
  ): Promise<LedgerEntry[]> {
    const entries: TransactionEntry[] = [
      // Credit: Decrease crypto asset (released to customer)
      {
        account: 'asset:crypto',
        amount: cryptoAmount,
        type: 'credit',
        currency: cryptoAsset,
        description: `Crypto released for order ${orderId}`,
      },
      // Debit: Increase customer crypto liability
      {
        account: 'liability:customer_crypto',
        amount: cryptoAmount,
        type: 'debit',
        currency: cryptoAsset,
        description: `Crypto delivery for order ${orderId}`,
      },
    ];

    return await this.recordTransaction(entries, orderId, 'crypto_release', orderId);
  }

  async recordRefund(
    orderId: string,
    amount: string,
    currency: string,
  ): Promise<LedgerEntry[]> {
    const entries: TransactionEntry[] = [
      // Credit: Decrease bank asset (money going out)
      {
        account: 'asset:bank',
        amount,
        type: 'credit',
        currency,
        description: `Refund for order ${orderId}`,
      },
      // Debit: Increase customer liability (we owe them)
      {
        account: 'liability:customer',
        amount,
        type: 'debit',
        currency,
        description: `Refund to customer for order ${orderId}`,
      },
    ];

    return await this.recordTransaction(entries, orderId, 'refund', orderId);
  }

  async getAccountBalance(account: string, currency: string): Promise<string> {
    const result = await this.ledgerRepository
      .createQueryBuilder('entry')
      .select('SUM(entry.debit)::decimal', 'totalDebit')
      .addSelect('SUM(entry.credit)::decimal', 'totalCredit')
      .where('entry.account = :account', { account })
      .andWhere('entry.currency = :currency', { currency })
      .getRawOne();

    const totalDebit = new Decimal(result.totalDebit || 0);
    const totalCredit = new Decimal(result.totalCredit || 0);
    const balance = totalDebit.minus(totalCredit);

    return balance.toString();
  }

  async getAllAccountBalances(): Promise<AccountBalance[]> {
    const results = await this.ledgerRepository
      .createQueryBuilder('entry')
      .select('entry.account', 'account')
      .addSelect('entry.currency', 'currency')
      .addSelect('SUM(entry.debit)::decimal', 'totalDebit')
      .addSelect('SUM(entry.credit)::decimal', 'totalCredit')
      .groupBy('entry.account')
      .addGroupBy('entry.currency')
      .getRawMany();

    return results.map((result) => {
      const totalDebit = new Decimal(result.totalDebit || 0);
      const totalCredit = new Decimal(result.totalCredit || 0);
      const balance = totalDebit.minus(totalCredit);

      return {
        account: result.account,
        currency: result.currency,
        balance: balance.toString(),
      };
    });
  }

  async getOrderLedgerEntries(orderId: string): Promise<LedgerEntry[]> {
    return await this.ledgerRepository.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  private validateDoubleEntry(entries: TransactionEntry[]): {
    valid: boolean;
    error?: string;
  } {
    // Group entries by currency
    const byCurrency: { [currency: string]: { debits: Decimal; credits: Decimal } } = {};

    for (const entry of entries) {
      if (!byCurrency[entry.currency]) {
        byCurrency[entry.currency] = {
          debits: new Decimal(0),
          credits: new Decimal(0),
        };
      }

      if (entry.type === 'debit') {
        byCurrency[entry.currency].debits = byCurrency[entry.currency].debits.plus(
          new Decimal(entry.amount),
        );
      } else {
        byCurrency[entry.currency].credits = byCurrency[entry.currency].credits.plus(
          new Decimal(entry.amount),
        );
      }
    }

    // Verify debits equal credits for each currency
    for (const [currency, totals] of Object.entries(byCurrency)) {
      if (!totals.debits.equals(totals.credits)) {
        return {
          valid: false,
          error: `Debits (${totals.debits}) do not equal credits (${totals.credits}) for currency ${currency}`,
        };
      }
    }

    return { valid: true };
  }

  private async verifyLedgerBalance(queryRunner: any): Promise<void> {
    const result = await queryRunner.manager
      .createQueryBuilder(LedgerEntry, 'entry')
      .select('entry.currency', 'currency')
      .addSelect('SUM(entry.debit)::decimal', 'totalDebit')
      .addSelect('SUM(entry.credit)::decimal', 'totalCredit')
      .groupBy('entry.currency')
      .getRawMany();

    for (const row of result) {
      const totalDebit = new Decimal(row.totalDebit || 0);
      const totalCredit = new Decimal(row.totalCredit || 0);

      if (!totalDebit.equals(totalCredit)) {
        throw new Error(
          `Ledger imbalance detected for ${row.currency}: Debits=${totalDebit}, Credits=${totalCredit}`,
        );
      }
    }

    this.logger.log('Ledger balance verified successfully');
  }
}
