# Integration Guide

Complete guide for integrating with external services in the OTC Automation Backend.

## Table of Contents

1. [Binance P2P API](#binance-p2p-api)
2. [NPP Payment Integration](#npp-payment-integration)
3. [Sumsub KYC Integration](#sumsub-kyc-integration)
4. [Webhook Configuration](#webhook-configuration)
5. [Testing Integrations](#testing-integrations)

## Binance P2P API

### Overview

The Binance P2P API integration enables automated cryptocurrency buying and selling through Binance's peer-to-peer marketplace.

### Configuration

Add to your `.env` file:

```bash
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
BINANCE_BASE_URL=https://api.binance.com
BINANCE_WEBHOOK_SECRET=your_webhook_secret
```

### Getting API Credentials

1. Log in to your Binance account
2. Go to **API Management**
3. Create a new API key
4. Enable **P2P Trading** permission
5. Whitelist your server IP addresses
6. Save the API key and secret securely

### Creating a P2P Ad

```typescript
const ad = await binanceService.createP2PAd({
  asset: 'USDT',
  fiatUnit: 'AUD',
  tradeType: 'BUY',
  price: '1.50',
  totalAmount: '10000',
  minSingleTransAmount: '100',
  maxSingleTransAmount: '5000',
  payTypes: ['BANK'],
});
```

### Webhook Setup

Configure Binance to send webhooks to:
```
https://your-domain.com/webhooks/binance
```

Webhook payload example:
```json
{
  "orderId": "123456789",
  "orderNumber": "B123456",
  "status": "CONFIRMED",
  "asset": "USDT",
  "fiat": "AUD",
  "amount": "1000.00",
  "totalPrice": "1500.00",
  "createTime": 1640000000000
}
```

### Error Handling

Common errors and solutions:

| Error Code | Description | Solution |
|------------|-------------|----------|
| -1000 | Unknown error | Check API key permissions |
| -1021 | Timestamp error | Sync server time with NTP |
| -2015 | Invalid API key | Verify API key is correct |
| -3020 | Insufficient balance | Top up Binance account |

### Rate Limits

- **API Calls**: 1200 requests per minute
- **Order Creation**: 10 per second
- **Order Status**: 100 per second

## NPP Payment Integration

### Overview

NPP (New Payments Platform) integration enables real-time AUD payments for Australian customers.

### Configuration

Add to your `.env` file:

```bash
NPP_MERCHANT_ID=your_merchant_id
NPP_API_KEY=your_api_key
NPP_API_SECRET=your_api_secret
NPP_BASE_URL=https://api.npp-provider.com
NPP_CALLBACK_URL=https://your-domain.com/webhooks/npp
```

### Provider Registration

Contact an NPP service provider:
- Cuscal
- EML Payments
- Monoova
- Indue

Submit these documents:
1. Business registration
2. Bank account details
3. AML/CTF policy
4. Directors' identification

### PayID Resolution

```typescript
const payIdInfo = await nppService.resolvePayID('customer@example.com');

console.log(payIdInfo);
// {
//   payId: 'customer@example.com',
//   name: 'John Smith',
//   accountNumber: '12345678',
//   bsb: '123-456',
//   isVerified: true
// }
```

### Initiating Payment

```typescript
const payment = await nppService.initiatePayment({
  amount: '1000.00',
  currency: 'AUD',
  payerAccount: '87654321',
  payerBsb: '654-321',
  payeeName: 'OTC Platform',
  payeeAccount: '12345678',
  payeeBsb: '123-456',
  reference: 'ORDER-123',
  description: 'Cryptocurrency purchase',
});

console.log(payment.transactionId); // Use to track payment
```

### Webhook Setup

Configure NPP provider to send webhooks to:
```
https://your-domain.com/webhooks/npp
```

Webhook payload example:
```json
{
  "transactionId": "NPP123456789",
  "status": "completed",
  "amount": "1000.00",
  "currency": "AUD",
  "reference": "ORDER-123",
  "payerName": "John Smith",
  "completedAt": "2024-01-15T10:30:00Z"
}
```

### Testing

Use the NPP sandbox environment:
```bash
NPP_BASE_URL=https://sandbox.npp-provider.com
```

Test PayIDs:
- `success@test.com` - Successful payment
- `failure@test.com` - Failed payment
- `timeout@test.com` - Payment timeout

## Sumsub KYC Integration

### Overview

Sumsub provides automated KYC (Know Your Customer) and AML (Anti-Money Laundering) verification.

### Configuration

Add to your `.env` file:

```bash
SUMSUB_APP_TOKEN=your_app_token
SUMSUB_SECRET_KEY=your_secret_key
SUMSUB_BASE_URL=https://api.sumsub.com
SUMSUB_WEBHOOK_URL=https://your-domain.com/webhooks/sumsub
SUMSUB_WEBHOOK_SECRET=your_webhook_secret
```

### Getting API Credentials

1. Sign up at https://sumsub.com
2. Go to **Settings** > **API**
3. Create an App Token
4. Generate a Secret Key
5. Configure webhook URL

### Creating Applicant

```typescript
const applicant = await sumsubService.createApplicant({
  externalUserId: user.id,
  email: user.email,
  phone: user.phone,
  fixedInfo: {
    firstName: user.firstName,
    lastName: user.lastName,
    dob: '1990-01-15',
    country: 'AUS',
  },
});

console.log(applicant.id); // Sumsub applicant ID
```

### Getting Access Token

```typescript
const accessToken = await sumsubService.getAccessToken(
  applicant.id,
  'basic-kyc-level'
);

// Return token to frontend for Sumsub SDK
res.json({ accessToken });
```

### Frontend Integration

```html
<div id="sumsub-websdk-container"></div>

<script src="https://static.sumsub.com/idensic/static/sns-websdk-builder.js"></script>
<script>
  const snsWebSdkInstance = snsWebSdk
    .Builder('your-app-token', accessToken)
    .withConf({
      lang: 'en',
      email: 'user@example.com',
    })
    .on('idCheck.onReady', () => {
      console.log('KYC ready');
    })
    .on('idCheck.onComplete', () => {
      console.log('KYC completed');
    })
    .build();

  snsWebSdkInstance.launch('#sumsub-websdk-container');
</script>
```

### Webhook Setup

Configure Sumsub to send webhooks to:
```
https://your-domain.com/webhooks/sumsub
```

Webhook payload example:
```json
{
  "applicantId": "5e6d4c7b8f9a0b1c2d3e4f5a",
  "inspectionId": "5e6d4c7b8f9a0b1c2d3e4f5b",
  "correlationId": "req-123",
  "externalUserId": "user-456",
  "type": "applicantReviewed",
  "reviewStatus": "completed",
  "reviewResult": {
    "reviewAnswer": "GREEN",
    "rejectLabels": [],
    "moderationComment": "All checks passed"
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### KYC Levels

Configure different verification levels:

| Level | Documents | Checks | Use Case |
|-------|-----------|--------|----------|
| Basic | ID card | Face match | Small transactions |
| Standard | ID + Proof of address | Face + Liveness | Regular trading |
| Enhanced | Full documents | All checks + AML | Large transactions |

### Sanctions Screening

```typescript
const isSanctioned = await sumsubService.checkSanctions(applicantId);

if (isSanctioned) {
  await userService.suspendUser(userId, 'Sanctioned entity');
}
```

## Webhook Configuration

### Security

All webhooks must be verified:

1. **Signature Verification**
```typescript
const isValid = service.verifyWebhookSignature(payload, signature);
if (!isValid) {
  throw new UnauthorizedException('Invalid signature');
}
```

2. **IP Whitelisting**

Add provider IPs to your firewall:
```nginx
# Binance IPs
allow 18.136.0.0/16;
allow 52.220.0.0/16;

# Sumsub IPs
allow 18.156.0.0/16;
allow 3.120.0.0/16;
```

3. **Idempotency**

Store webhook IDs to prevent duplicate processing:
```typescript
const existing = await webhookLogRepository.findOne({
  where: {
    source: 'binance',
    payload: { orderId: webhook.orderId }
  }
});

if (existing?.processed) {
  return; // Already processed
}
```

### Retry Logic

Implement exponential backoff:
```typescript
async function processWebhook(webhook: WebhookLog) {
  const maxRetries = 3;
  let delay = 1000; // Start with 1 second

  for (let i = 0; i < maxRetries; i++) {
    try {
      await handleWebhook(webhook);
      webhook.processed = true;
      break;
    } catch (error) {
      webhook.retryCount++;
      webhook.errorMessage = error.message;

      if (i < maxRetries - 1) {
        await sleep(delay);
        delay *= 2; // Exponential backoff
      }
    }
  }

  await webhookLogRepository.save(webhook);
}
```

### Webhook Endpoints Summary

| Service | Endpoint | Method | Authentication |
|---------|----------|--------|----------------|
| Binance | /webhooks/binance | POST | Signature |
| NPP | /webhooks/npp | POST | Signature |
| Sumsub | /webhooks/sumsub | POST | Signature |

## Testing Integrations

### Unit Tests

```typescript
describe('BinanceService', () => {
  it('should create P2P ad', async () => {
    const ad = await binanceService.createP2PAd({
      asset: 'USDT',
      fiatUnit: 'AUD',
      tradeType: 'BUY',
      price: '1.50',
      totalAmount: '10000',
      minSingleTransAmount: '100',
      maxSingleTransAmount: '5000',
    });

    expect(ad.advNo).toBeDefined();
  });

  it('should verify webhook signature', () => {
    const payload = { orderId: '123' };
    const signature = binanceService.generateSignature(payload);
    const isValid = binanceService.verifyWebhookSignature(payload, signature);

    expect(isValid).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Order Flow Integration', () => {
  it('should complete full order flow', async () => {
    // 1. Create order
    const order = await orderService.create({
      userId: user.id,
      type: 'buy',
      cryptoAsset: 'USDT',
      fiatCurrency: 'AUD',
      cryptoAmount: '1000',
      price: '1.50',
    });

    // 2. Create Binance ad
    expect(order.binanceAdId).toBeDefined();

    // 3. Simulate payment
    await nppService.initiatePayment({
      amount: '1500.00',
      reference: order.id,
    });

    // 4. Process webhook
    await webhookService.processBinanceWebhook({
      orderId: order.binanceOrderId,
      status: 'CONFIRMED',
    });

    // 5. Verify order completed
    const updated = await orderService.findById(order.id);
    expect(updated.status).toBe('completed');
  });
});
```

### Manual Testing

#### Testing Binance Integration

```bash
# List current ads
curl -X GET "https://api.binance.com/sapi/v1/c2c/ads/list" \
  -H "X-MBX-APIKEY: your_key"

# Test webhook
curl -X POST "http://localhost:3000/webhooks/binance" \
  -H "Content-Type: application/json" \
  -H "X-Signature: signature" \
  -d '{"orderId":"123","status":"CONFIRMED"}'
```

#### Testing NPP Integration

```bash
# Test PayID resolution
curl -X POST "http://localhost:3000/api/npp/resolve-payid" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tenant_key" \
  -d '{"payId":"test@example.com"}'

# Test webhook
curl -X POST "http://localhost:3000/webhooks/npp" \
  -H "Content-Type: application/json" \
  -H "X-Signature: signature" \
  -d '{"transactionId":"NPP123","status":"completed"}'
```

#### Testing Sumsub Integration

```bash
# Create applicant
curl -X POST "http://localhost:3000/api/kyc/initiate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{"userId":"user-123"}'

# Test webhook
curl -X POST "http://localhost:3000/webhooks/sumsub" \
  -H "Content-Type: application/json" \
  -H "X-Signature: signature" \
  -d '{"applicantId":"123","type":"applicantReviewed","reviewResult":{"reviewAnswer":"GREEN"}}'
```

## Monitoring & Alerts

### Webhook Monitoring

```sql
-- Check failed webhooks
SELECT * FROM webhook_logs
WHERE processed = false
AND retry_count >= 3
ORDER BY created_at DESC;

-- Check webhook processing time
SELECT
  source,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_seconds
FROM webhook_logs
WHERE processed = true
GROUP BY source;
```

### Alert Configuration

Set up alerts for:
- Failed webhook processing (>3 retries)
- API rate limit approaching
- Integration downtime
- Signature verification failures
- Suspicious activity patterns

## Troubleshooting

### Binance Issues

**Problem**: API key invalid
- **Solution**: Verify key is correct and has P2P permission

**Problem**: Timestamp error
- **Solution**: Sync server time: `sudo ntpdate -s time.nist.gov`

### NPP Issues

**Problem**: Payment timeout
- **Solution**: Check NPP provider status, retry payment

**Problem**: PayID not found
- **Solution**: Verify PayID format, check with customer

### Sumsub Issues

**Problem**: Applicant creation fails
- **Solution**: Verify all required fields provided, check email format

**Problem**: Webhook signature invalid
- **Solution**: Verify webhook secret matches Sumsub dashboard

## Support Contacts

- **Binance Support**: https://www.binance.com/en/support
- **Sumsub Support**: support@sumsub.com
- **NPP Provider**: Contact your specific provider

## Additional Resources

- [Binance API Documentation](https://binance-docs.github.io/apidocs/)
- [Sumsub API Documentation](https://docs.sumsub.com/)
- [NPP Technical Specifications](https://www.nppa.com.au/technical-specifications/)
