import { registerAs } from '@nestjs/config';

export interface SumsubConfig {
  appToken: string;
  secretKey: string;
  baseUrl: string;
  webhookUrl: string;
  webhookSecret: string;
}

export default registerAs('sumsub', (): SumsubConfig => ({
  appToken: process.env.SUMSUB_APP_TOKEN || '',
  secretKey: process.env.SUMSUB_SECRET_KEY || '',
  baseUrl: process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com',
  webhookUrl: process.env.SUMSUB_WEBHOOK_URL || 'http://localhost:3000/webhooks/sumsub',
  webhookSecret: process.env.SUMSUB_WEBHOOK_SECRET || '',
}));
