import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../../database/entities/order.entity';

export class UpdateOrderDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
    description: 'Order status',
    required: false,
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({
    example: 'Order cancelled by user',
    description: 'Reason for failure or cancellation',
    required: false,
  })
  @IsString()
  @IsOptional()
  failureReason?: string;
}
