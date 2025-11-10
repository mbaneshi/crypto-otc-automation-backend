import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { Order, OrderStatus, OrderType } from '../../database/entities/order.entity';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: Order,
  })
  @ApiResponse({ status: 403, description: 'KYC verification required' })
  async create(@CurrentUser() user: User, @Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.ordersService.create(user.id, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for the current user' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiQuery({ name: 'type', enum: OrderType, required: false })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: [Order],
  })
  async findAll(
    @CurrentUser() user: User,
    @Query('status') status?: OrderStatus,
    @Query('type') type?: OrderType,
  ): Promise<Order[]> {
    return this.ordersService.findAll(user.id, { status, type });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Order statistics retrieved successfully',
    schema: {
      properties: {
        total: { type: 'number' },
        completed: { type: 'number' },
        pending: { type: 'number' },
        cancelled: { type: 'number' },
        failed: { type: 'number' },
        totalVolume: { type: 'number' },
      },
    },
  })
  async getStats(@CurrentUser() user: User): Promise<any> {
    return this.ordersService.getOrderStats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: Order,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User): Promise<Order> {
    return this.ordersService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({
    status: 200,
    description: 'Order updated successfully',
    type: Order,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<Order> {
    return this.ordersService.update(id, user.id, updateOrderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: Order,
  })
  @ApiResponse({ status: 400, description: 'Cannot cancel order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('reason') reason?: string,
  ): Promise<Order> {
    return this.ordersService.cancel(id, user.id, reason);
  }
}
