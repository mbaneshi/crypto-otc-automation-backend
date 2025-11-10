import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('OTC Automation Backend API')
    .setDescription(
      'Multi-tenant OTC automation platform with Binance P2P, NPP payments, and KYC integration',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
    .addTag('auth', 'Authentication endpoints')
    .addTag('tenants', 'Tenant management')
    .addTag('users', 'User management')
    .addTag('orders', 'Order management')
    .addTag('payments', 'Payment processing')
    .addTag('kyc', 'KYC verification')
    .addTag('ledger', 'Ledger and accounting')
    .addTag('reconciliation', 'Reconciliation')
    .addTag('webhooks', 'Webhook handlers')
    .addTag('dashboard', 'Dashboard and analytics')
    .addTag('admin', 'Admin operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
  ========================================
  OTC Automation Backend
  ========================================
  Server running on: http://localhost:${port}
  API Documentation: http://localhost:${port}/api/docs
  Environment: ${process.env.NODE_ENV || 'development'}
  ========================================
  `);
}

bootstrap();
