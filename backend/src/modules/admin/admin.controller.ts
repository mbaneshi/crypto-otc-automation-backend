import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, KycStatus } from '../../database/entities/user.entity';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async getAllUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return this.adminService.getAllUsers(page, limit);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string): Promise<any> {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ): Promise<any> {
    return this.adminService.updateUserRole(id, role);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Update user active status (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully',
  })
  async updateUserStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ): Promise<any> {
    return this.adminService.updateUserStatus(id, isActive);
  }

  @Put('users/:id/kyc')
  @ApiOperation({ summary: 'Update user KYC status (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'KYC status updated successfully',
  })
  async updateUserKycStatus(
    @Param('id') id: string,
    @Body('kycStatus') kycStatus: KycStatus,
  ): Promise<any> {
    return this.adminService.updateUserKycStatus(id, kycStatus);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get all tenants (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenants retrieved successfully',
  })
  async getAllTenants(): Promise<any> {
    return this.adminService.getAllTenants();
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant by ID (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenantById(@Param('id') id: string): Promise<any> {
    return this.adminService.getTenantById(id);
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new tenant (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
  })
  async createTenant(
    @Body() data: { name: string; apiKey: string; config: any },
  ): Promise<any> {
    return this.adminService.createTenant(data);
  }

  @Put('tenants/:id')
  @ApiOperation({ summary: 'Update tenant (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant updated successfully',
  })
  async updateTenant(
    @Param('id') id: string,
    @Body() data: { name?: string; config?: any; isActive?: boolean },
  ): Promise<any> {
    return this.adminService.updateTenant(id, data);
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant (admin only)' })
  @ApiResponse({
    status: 204,
    description: 'Tenant deleted successfully',
  })
  async deleteTenant(@Param('id') id: string): Promise<void> {
    await this.adminService.deleteTenant(id);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get all orders (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
  })
  async getAllOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return this.adminService.getAllOrders(page, limit);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order by ID (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(@Param('id') id: string): Promise<any> {
    return this.adminService.getOrderById(id);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get all payments (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
  })
  async getAllPayments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return this.adminService.getAllPayments(page, limit);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  async getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ): Promise<any> {
    return this.adminService.getAuditLogs(page, limit, { userId, action });
  }

  @Get('reconciliations')
  @ApiOperation({ summary: 'Get reconciliation records (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Reconciliations retrieved successfully',
  })
  async getReconciliations(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return this.adminService.getReconciliations(page, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics retrieved successfully',
  })
  async getPlatformStats(): Promise<any> {
    return this.adminService.getPlatformStats();
  }
}
