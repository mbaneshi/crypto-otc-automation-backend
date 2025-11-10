import { registerAs } from '@nestjs/config';

export interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  webhookSecret: string;
}

export default registerAs('binance', (): BinanceConfig => ({
  apiKey: process.env.BINANCE_API_KEY || '',
  apiSecret: process.env.BINANCE_API_SECRET || '',
  baseUrl: process.env.BINANCE_BASE_URL || 'https://testnet.binance.vision',
  webhookSecret: process.env.BINANCE_WEBHOOK_SECRET || '',
}));
