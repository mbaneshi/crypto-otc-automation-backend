import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('KYC')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate KYC verification process' })
  @ApiResponse({
    status: 200,
    description: 'KYC process initiated successfully',
    schema: {
      properties: {
        applicantId: { type: 'string' },
        accessToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'KYC already approved or invalid request' })
  async initiateKyc(
    @CurrentUser() user: User,
  ): Promise<{ applicantId: string; accessToken: string }> {
    return this.kycService.initiateKyc(user.id);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get KYC verification status' })
  @ApiResponse({
    status: 200,
    description: 'KYC status retrieved successfully',
    schema: {
      properties: {
        status: { type: 'string', enum: ['pending', 'in_review', 'approved', 'rejected', 'expired'] },
        applicantId: { type: 'string' },
        approvedAt: { type: 'string', format: 'date-time' },
        expiresAt: { type: 'string', format: 'date-time' },
        details: { type: 'object' },
      },
    },
  })
  async getKycStatus(@CurrentUser() user: User): Promise<any> {
    return this.kycService.getKycStatus(user.id);
  }

  @Get('sanctions-check')
  @ApiOperation({ summary: 'Check user against sanctions lists' })
  @ApiResponse({
    status: 200,
    description: 'Sanctions check completed',
    schema: {
      properties: {
        isSanctioned: { type: 'boolean' },
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'KYC not initiated' })
  async checkSanctions(@CurrentUser() user: User): Promise<{ isSanctioned: boolean; details?: any }> {
    return this.kycService.checkSanctions(user.id);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset KYC verification (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'KYC reset successfully',
  })
  @ApiResponse({ status: 400, description: 'KYC not initiated' })
  async resetKyc(@CurrentUser() user: User): Promise<{ message: string }> {
    await this.kycService.resetKyc(user.id);
    return { message: 'KYC reset successfully' };
  }
}
