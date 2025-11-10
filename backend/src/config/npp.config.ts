import { registerAs } from '@nestjs/config';

export interface NPPConfig {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  callbackUrl: string;
}

export default registerAs('npp', (): NPPConfig => ({
  merchantId: process.env.NPP_MERCHANT_ID || '',
  apiKey: process.env.NPP_API_KEY || '',
  apiSecret: process.env.NPP_API_SECRET || '',
  baseUrl: process.env.NPP_BASE_URL || 'https://api.npp-provider.com',
  callbackUrl: process.env.NPP_CALLBACK_URL || 'http://localhost:3000/webhooks/npp',
}));
