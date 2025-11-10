import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../database/entities/user.entity';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('user')
  @ApiOperation({ summary: 'Get user dashboard with statistics' })
  @ApiResponse({
    status: 200,
    description: 'User dashboard retrieved successfully',
  })
  async getUserDashboard(@CurrentUser() user: User): Promise<any> {
    return this.dashboardService.getUserDashboard(user.id);
  }

  @Get('admin')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get admin dashboard with platform statistics' })
  @ApiResponse({
    status: 200,
    description: 'Admin dashboard retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAdminDashboard(): Promise<any> {
    return this.dashboardService.getAdminDashboard();
  }

  @Get('orders/stats')
  @ApiOperation({ summary: 'Get order statistics' })
  @ApiResponse({
    status: 200,
    description: 'Order statistics retrieved successfully',
  })
  async getOrderStats(@CurrentUser() user: User): Promise<any> {
    return this.dashboardService.getOrderStats(user.id);
  }

  @Get('payments/stats')
  @ApiOperation({ summary: 'Get payment statistics' })
  @ApiResponse({
    status: 200,
    description: 'Payment statistics retrieved successfully',
  })
  async getPaymentStats(@CurrentUser() user: User): Promise<any> {
    return this.dashboardService.getPaymentStats(user.id);
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get trading volume statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Volume statistics retrieved successfully',
  })
  async getVolumeStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.dashboardService.getVolumeStats(start, end);
  }

  @Get('revenue')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get revenue statistics (admin only)' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Revenue statistics retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.dashboardService.getRevenue(start, end);
  }
}
