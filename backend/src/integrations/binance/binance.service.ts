import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface BinanceP2PConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}

export interface CreateP2PAdParams {
  asset: string; // e.g., 'USDT'
  fiatUnit: string; // e.g., 'AUD'
  tradeType: 'BUY' | 'SELL';
  price: string;
  totalAmount: string;
  minSingleTransAmount: string;
  maxSingleTransAmount: string;
  payTypes?: string[]; // e.g., ['BANK']
}

export interface P2PAdResponse {
  advNo: string;
  classify: string;
  tradeType: string;
  asset: string;
  fiatUnit: string;
  price: string;
  tradableQuantity: string;
  minSingleTransAmount: string;
  maxSingleTransAmount: string;
}

export interface P2POrderStatus {
  orderNumber: string;
  orderStatus: number; // 0: pending, 1: trading, 2: buyer paid, 3: seller released, 4: cancelled, 5: appealing
  orderType: number; // 0: buy, 1: sell
  asset: string;
  fiat: string;
  totalPrice: string;
  amount: string;
  createTime: number;
  updateTime: number;
}

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: BinanceP2PConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      apiKey: this.configService.get<string>('binance.apiKey'),
      apiSecret: this.configService.get<string>('binance.apiSecret'),
      baseUrl: this.configService.get<string>('binance.baseUrl'),
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'X-MBX-APIKEY': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async createP2PAd(params: CreateP2PAdParams): Promise<P2PAdResponse> {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature(params, timestamp);

      this.logger.log(`Creating P2P ad for ${params.asset}/${params.fiatUnit}`);

      const response = await this.httpClient.post(
        '/sapi/v1/c2c/ads/create',
        null,
        {
          params: {
            ...params,
            timestamp,
            signature,
          },
        },
      );

      this.logger.log(`P2P ad created successfully: ${response.data.advNo}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create P2P ad: ${error.message}`, error.stack);
      throw error;
    }
  }

  async listP2PAds(tradeType?: 'BUY' | 'SELL'): Promise<P2PAdResponse[]> {
    try {
      const timestamp = Date.now();
      const params = tradeType ? { tradeType, timestamp } : { timestamp };
      const signature = this.generateSignature(params, timestamp);

      const response = await this.httpClient.get('/sapi/v1/c2c/ads/list', {
        params: {
          ...params,
          signature,
        },
      });

      return response.data.data || [];
    } catch (error) {
      this.logger.error(`Failed to list P2P ads: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateP2PAd(advNo: string, params: Partial<CreateP2PAdParams>): Promise<void> {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({ advNo, ...params }, timestamp);

      await this.httpClient.post(
        '/sapi/v1/c2c/ads/update',
        null,
        {
          params: {
            advNo,
            ...params,
            timestamp,
            signature,
          },
        },
      );

      this.logger.log(`P2P ad updated successfully: ${advNo}`);
    } catch (error) {
      this.logger.error(`Failed to update P2P ad: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteP2PAd(advNo: string): Promise<void> {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({ advNo }, timestamp);

      await this.httpClient.post(
        '/sapi/v1/c2c/ads/delete',
        null,
        {
          params: {
            advNo,
            timestamp,
            signature,
          },
        },
      );

      this.logger.log(`P2P ad deleted successfully: ${advNo}`);
    } catch (error) {
      this.logger.error(`Failed to delete P2P ad: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getOrderStatus(orderNumber: string): Promise<P2POrderStatus> {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({ orderNumber }, timestamp);

      const response = await this.httpClient.get(
        '/sapi/v1/c2c/orderMatch/getUserOrderDetail',
        {
          params: {
            orderNumber,
            timestamp,
            signature,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get order status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async confirmOrder(orderNumber: string): Promise<void> {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({ orderNumber }, timestamp);

      await this.httpClient.post(
        '/sapi/v1/c2c/orderMatch/confirm',
        null,
        {
          params: {
            orderNumber,
            timestamp,
            signature,
          },
        },
      );

      this.logger.log(`Order confirmed successfully: ${orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to confirm order: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAccountBalance(): Promise<{ [asset: string]: string }> {
    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({}, timestamp);

      const response = await this.httpClient.get('/sapi/v1/capital/config/getall', {
        params: {
          timestamp,
          signature,
        },
      });

      const balances: { [asset: string]: string } = {};

      for (const coin of response.data) {
        if (parseFloat(coin.free) > 0) {
          balances[coin.coin] = coin.free;
        }
      }

      return balances;
    } catch (error) {
      this.logger.error(`Failed to get account balance: ${error.message}`, error.stack);
      throw error;
    }
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.apiSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error(`Failed to verify webhook signature: ${error.message}`);
      return false;
    }
  }

  private generateSignature(params: any, timestamp: number): string {
    const queryString = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const signString = queryString ? `${queryString}&timestamp=${timestamp}` : `timestamp=${timestamp}`;

    return crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(signString)
      .digest('hex');
  }
}
