import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsDecimal, IsOptional, IsObject, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '../../../database/entities/order.entity';

export class CreateOrderDto {
  @ApiProperty({
    enum: OrderType,
    example: OrderType.BUY,
    description: 'Order type: buy or sell',
  })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({
    example: 'USDT',
    description: 'Cryptocurrency asset',
  })
  @IsString()
  cryptoAsset: string;

  @ApiProperty({
    example: 'AUD',
    description: 'Fiat currency',
  })
  @IsString()
  fiatCurrency: string;

  @ApiProperty({
    example: '100.00',
    description: 'Amount of cryptocurrency',
  })
  @IsString()
  @Type(() => String)
  cryptoAmount: string;

  @ApiProperty({
    example: '150.50',
    description: 'Amount in fiat currency',
  })
  @IsString()
  @Type(() => String)
  fiatAmount: string;

  @ApiProperty({
    example: '1.505',
    description: 'Price per unit',
  })
  @IsString()
  @Type(() => String)
  price: string;

  @ApiProperty({
    example: { customerPaymentMethod: 'bank_transfer', customerBankDetails: {} },
    description: 'Additional order metadata',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: {
    customerPaymentMethod?: string;
    customerBankDetails?: any;
  };
}
