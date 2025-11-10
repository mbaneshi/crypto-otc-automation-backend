import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface NPPConfig {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  callbackUrl: string;
}

export interface PayIDResolutionParams {
  payId: string;
}

export interface PayIDResolutionResponse {
  payId: string;
  name: string;
  accountNumber: string;
  bsb: string;
  isVerified: boolean;
}

export interface InitiatePaymentParams {
  amount: string;
  currency: string;
  payerAccount: string;
  payerBsb: string;
  payeeName: string;
  payeeAccount: string;
  payeeBsb: string;
  reference: string;
  description?: string;
}

export interface PaymentResponse {
  transactionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: string;
  currency: string;
  createdAt: string;
  completedAt?: string;
}

export interface PaymentStatusResponse extends PaymentResponse {
  failureReason?: string;
  metadata?: any;
}

@Injectable()
export class NPPService {
  private readonly logger = new Logger(NPPService.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: NPPConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      merchantId: this.configService.get<string>('npp.merchantId'),
      apiKey: this.configService.get<string>('npp.apiKey'),
      apiSecret: this.configService.get<string>('npp.apiSecret'),
      baseUrl: this.configService.get<string>('npp.baseUrl'),
      callbackUrl: this.configService.get<string>('npp.callbackUrl'),
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
    });
  }

  async resolvePayID(payId: string): Promise<PayIDResolutionResponse> {
    try {
      this.logger.log(`Resolving PayID: ${payId}`);

      const timestamp = Date.now();
      const signature = this.generateSignature({ payId, timestamp });

      const response = await this.httpClient.post(
        '/api/v1/payid/resolve',
        {
          payId,
          merchantId: this.config.merchantId,
          timestamp,
        },
        {
          headers: {
            'X-Signature': signature,
          },
        },
      );

      this.logger.log(`PayID resolved successfully: ${payId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to resolve PayID: ${error.message}`, error.stack);
      throw error;
    }
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<PaymentResponse> {
    try {
      this.logger.log(`Initiating payment: ${params.reference}`);

      const timestamp = Date.now();
      const payload = {
        ...params,
        merchantId: this.config.merchantId,
        callbackUrl: this.config.callbackUrl,
        timestamp,
      };

      const signature = this.generateSignature(payload);

      const response = await this.httpClient.post(
        '/api/v1/payments/initiate',
        payload,
        {
          headers: {
            'X-Signature': signature,
          },
        },
      );

      this.logger.log(`Payment initiated successfully: ${response.data.transactionId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to initiate payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({ transactionId, timestamp });

      const response = await this.httpClient.get(
        `/api/v1/payments/${transactionId}`,
        {
          headers: {
            'X-Signature': signature,
          },
          params: {
            merchantId: this.config.merchantId,
            timestamp,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get payment status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async cancelPayment(transactionId: string): Promise<void> {
    try {
      this.logger.log(`Cancelling payment: ${transactionId}`);

      const timestamp = Date.now();
      const signature = this.generateSignature({ transactionId, timestamp });

      await this.httpClient.post(
        `/api/v1/payments/${transactionId}/cancel`,
        {
          merchantId: this.config.merchantId,
          timestamp,
        },
        {
          headers: {
            'X-Signature': signature,
          },
        },
      );

      this.logger.log(`Payment cancelled successfully: ${transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async refundPayment(transactionId: string, amount: string, reason: string): Promise<PaymentResponse> {
    try {
      this.logger.log(`Refunding payment: ${transactionId}`);

      const timestamp = Date.now();
      const payload = {
        transactionId,
        amount,
        reason,
        merchantId: this.config.merchantId,
        timestamp,
      };

      const signature = this.generateSignature(payload);

      const response = await this.httpClient.post(
        `/api/v1/payments/${transactionId}/refund`,
        payload,
        {
          headers: {
            'X-Signature': signature,
          },
        },
      );

      this.logger.log(`Payment refunded successfully: ${transactionId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to refund payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAccountBalance(): Promise<{ [currency: string]: string }> {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({ timestamp });

      const response = await this.httpClient.get('/api/v1/account/balance', {
        headers: {
          'X-Signature': signature,
        },
        params: {
          merchantId: this.config.merchantId,
          timestamp,
        },
      });

      return response.data.balances;
    } catch (error) {
      this.logger.error(`Failed to get account balance: ${error.message}`, error.stack);
      throw error;
    }
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload);
      return signature === expectedSignature;
    } catch (error) {
      this.logger.error(`Failed to verify webhook signature: ${error.message}`);
      return false;
    }
  }

  private generateSignature(data: any): string {
    const sortedKeys = Object.keys(data).sort();
    const signString = sortedKeys
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(signString)
      .digest('hex');
  }
}
