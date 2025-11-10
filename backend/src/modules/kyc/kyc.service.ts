import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, KycStatus } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SumsubService } from '../../integrations/sumsub/sumsub.service';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly sumsubService: SumsubService,
  ) {}

  async initiateKyc(userId: string): Promise<{ applicantId: string; accessToken: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KycStatus.APPROVED) {
      throw new BadRequestException('KYC already approved for this user');
    }

    try {
      if (user.sumsubApplicantId) {
        const accessToken = await this.sumsubService.getAccessToken(user.sumsubApplicantId);

        return {
          applicantId: user.sumsubApplicantId,
          accessToken,
        };
      }

      const applicantResponse = await this.sumsubService.createApplicant({
        externalUserId: user.id,
        email: user.email,
        phone: user.phone,
        fixedInfo: {
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });

      user.sumsubApplicantId = applicantResponse.id;
      user.kycStatus = KycStatus.IN_REVIEW;
      await this.userRepository.save(user);

      const accessToken = await this.sumsubService.getAccessToken(applicantResponse.id);

      await this.createAuditLog({
        userId,
        action: 'KYC_INITIATED',
        entityType: 'User',
        entityId: user.id,
        metadata: { applicantId: applicantResponse.id },
      });

      this.logger.log(`KYC initiated for user: ${userId}, applicant: ${applicantResponse.id}`);

      return {
        applicantId: applicantResponse.id,
        accessToken,
      };
    } catch (error) {
      this.logger.error(`Failed to initiate KYC: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getKycStatus(userId: string): Promise<{
    status: KycStatus;
    applicantId?: string;
    approvedAt?: Date;
    expiresAt?: Date;
    details?: any;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let details = null;

    if (user.sumsubApplicantId) {
      try {
        const verificationStatus = await this.sumsubService.getApplicantStatus(user.sumsubApplicantId);
        details = verificationStatus;

        await this.syncKycStatus(user, verificationStatus.status);
      } catch (error) {
        this.logger.error(`Failed to get KYC status from Sumsub: ${error.message}`);
      }
    }

    return {
      status: user.kycStatus,
      applicantId: user.sumsubApplicantId,
      approvedAt: user.kycApprovedAt,
      expiresAt: user.kycExpiresAt,
      details,
    };
  }

  async processKycWebhook(payload: any): Promise<void> {
    try {
      const { applicantId, externalUserId, reviewResult } = payload;

      const user = await this.userRepository.findOne({
        where: [{ id: externalUserId }, { sumsubApplicantId: applicantId }],
      });

      if (!user) {
        this.logger.warn(`User not found for KYC webhook: ${externalUserId || applicantId}`);
        return;
      }

      const previousStatus = user.kycStatus;

      if (reviewResult?.reviewAnswer === 'GREEN') {
        user.kycStatus = KycStatus.APPROVED;
        user.kycApprovedAt = new Date();
        user.kycExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

        await this.createAuditLog({
          userId: user.id,
          action: 'KYC_APPROVED',
          entityType: 'User',
          entityId: user.id,
          metadata: { applicantId, reviewResult },
        });

        this.logger.log(`KYC approved for user: ${user.id}`);
      } else if (reviewResult?.reviewAnswer === 'RED') {
        user.kycStatus = KycStatus.REJECTED;
        user.kycApprovedAt = null;
        user.kycExpiresAt = null;

        await this.createAuditLog({
          userId: user.id,
          action: 'KYC_REJECTED',
          entityType: 'User',
          entityId: user.id,
          metadata: {
            applicantId,
            reviewResult,
            rejectLabels: reviewResult?.rejectLabels,
            moderationComment: reviewResult?.moderationComment,
          },
        });

        this.logger.log(`KYC rejected for user: ${user.id}`);
      } else if (reviewResult?.reviewAnswer === 'RETRY') {
        user.kycStatus = KycStatus.PENDING;

        await this.createAuditLog({
          userId: user.id,
          action: 'KYC_RETRY_REQUIRED',
          entityType: 'User',
          entityId: user.id,
          metadata: { applicantId, reviewResult },
        });

        this.logger.log(`KYC retry required for user: ${user.id}`);
      }

      await this.userRepository.save(user);

      this.logger.log(
        `KYC status updated for user ${user.id}: ${previousStatus} -> ${user.kycStatus}`,
      );
    } catch (error) {
      this.logger.error(`Failed to process KYC webhook: ${error.message}`, error.stack);
      throw error;
    }
  }

  async checkSanctions(userId: string): Promise<{ isSanctioned: boolean; details?: any }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.sumsubApplicantId) {
      throw new BadRequestException('KYC not initiated for this user');
    }

    try {
      const isSanctioned = await this.sumsubService.checkSanctions(user.sumsubApplicantId);

      await this.createAuditLog({
        userId,
        action: 'SANCTIONS_CHECK',
        entityType: 'User',
        entityId: user.id,
        metadata: { applicantId: user.sumsubApplicantId, isSanctioned },
      });

      this.logger.log(`Sanctions check for user ${userId}: ${isSanctioned ? 'FLAGGED' : 'CLEAR'}`);

      return {
        isSanctioned,
      };
    } catch (error) {
      this.logger.error(`Failed to check sanctions: ${error.message}`, error.stack);
      throw error;
    }
  }

  async resetKyc(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.sumsubApplicantId) {
      throw new BadRequestException('KYC not initiated for this user');
    }

    try {
      await this.sumsubService.resetApplicant(user.sumsubApplicantId);

      user.kycStatus = KycStatus.PENDING;
      user.kycApprovedAt = null;
      user.kycExpiresAt = null;
      await this.userRepository.save(user);

      await this.createAuditLog({
        userId,
        action: 'KYC_RESET',
        entityType: 'User',
        entityId: user.id,
        metadata: { applicantId: user.sumsubApplicantId },
      });

      this.logger.log(`KYC reset for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to reset KYC: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async syncKycStatus(
    user: User,
    sumsubStatus: 'pending' | 'approved' | 'rejected' | 'retry',
  ): Promise<void> {
    let newStatus: KycStatus;

    switch (sumsubStatus) {
      case 'approved':
        newStatus = KycStatus.APPROVED;
        if (!user.kycApprovedAt) {
          user.kycApprovedAt = new Date();
          user.kycExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        }
        break;
      case 'rejected':
        newStatus = KycStatus.REJECTED;
        break;
      case 'retry':
      case 'pending':
        newStatus = KycStatus.IN_REVIEW;
        break;
      default:
        return;
    }

    if (user.kycStatus !== newStatus) {
      user.kycStatus = newStatus;
      await this.userRepository.save(user);

      await this.createAuditLog({
        userId: user.id,
        action: 'KYC_STATUS_SYNCED',
        entityType: 'User',
        entityId: user.id,
        metadata: { newStatus, sumsubStatus },
      });
    }
  }

  private async createAuditLog(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: any;
  }): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create(data);
      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
    }
  }
}
