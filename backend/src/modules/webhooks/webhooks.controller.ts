import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('binance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Binance P2P webhooks' })
  @ApiHeader({ name: 'X-Signature', required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  async handleBinanceWebhook(
    @Body() payload: any,
    @Headers('X-Signature') signature: string,
  ): Promise<{ message: string }> {
    await this.webhooksService.processBinanceWebhook(payload, signature);
    return { message: 'Webhook processed successfully' };
  }

  @Post('npp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle NPP payment webhooks' })
  @ApiHeader({ name: 'X-Signature', required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  async handleNPPWebhook(
    @Body() payload: any,
    @Headers('X-Signature') signature: string,
  ): Promise<{ message: string }> {
    await this.webhooksService.processNPPWebhook(payload, signature);
    return { message: 'Webhook processed successfully' };
  }

  @Post('sumsub')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Sumsub KYC webhooks' })
  @ApiHeader({ name: 'X-Signature', required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  async handleSumsubWebhook(
    @Body() payload: any,
    @Headers('X-Signature') signature: string,
  ): Promise<{ message: string }> {
    await this.webhooksService.processSumsubWebhook(payload, signature);
    return { message: 'Webhook processed successfully' };
  }
}
