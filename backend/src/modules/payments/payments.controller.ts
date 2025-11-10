import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payment' })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: Payment,
  })
  @ApiResponse({ status: 400, description: 'Invalid order status or payment already exists' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async create(@CurrentUser() user: User, @Body() createPaymentDto: CreatePaymentDto): Promise<Payment> {
    return this.paymentsService.create(user.id, createPaymentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments for the current user' })
  @ApiQuery({ name: 'status', enum: PaymentStatus, required: false })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
    type: [Payment],
  })
  async findAll(@CurrentUser() user: User, @Query('status') status?: PaymentStatus): Promise<Payment[]> {
    return this.paymentsService.findAll(user.id, { status });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get payment statistics for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Payment statistics retrieved successfully',
    schema: {
      properties: {
        total: { type: 'number' },
        completed: { type: 'number' },
        pending: { type: 'number' },
        processing: { type: 'number' },
        failed: { type: 'number' },
        refunded: { type: 'number' },
        totalAmount: { type: 'number' },
      },
    },
  })
  async getStats(@CurrentUser() user: User): Promise<any> {
    return this.paymentsService.getPaymentStats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment retrieved successfully',
    type: Payment,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User): Promise<Payment> {
    return this.paymentsService.findOne(id, user.id);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a completed payment' })
  @ApiResponse({
    status: 200,
    description: 'Payment refunded successfully',
    type: Payment,
  })
  @ApiResponse({ status: 400, description: 'Cannot refund payment' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async refund(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ): Promise<Payment> {
    return this.paymentsService.refundPayment(id, user.id, reason);
  }
}
