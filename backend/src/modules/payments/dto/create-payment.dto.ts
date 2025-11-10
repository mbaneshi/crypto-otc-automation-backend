import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { PaymentMethod } from '../../../database/entities/payment.entity';

export class CreatePaymentDto {
  @ApiProperty({
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    description: 'Order ID',
  })
  @IsString()
  orderId: string;

  @ApiProperty({
    example: '150.50',
    description: 'Payment amount',
  })
  @IsString()
  amount: string;

  @ApiProperty({
    example: 'AUD',
    description: 'Payment currency',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.NPP,
    description: 'Payment method',
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    example: { bankDetails: {} },
    description: 'Additional payment metadata',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: any;
}
