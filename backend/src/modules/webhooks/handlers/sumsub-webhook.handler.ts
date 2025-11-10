import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, KycStatus } from '../../../database/entities/user.entity';
import { AuditLog } from '../../../database/entities/audit-log.entity';
import { WebhookLog } from '../../../database/entities/webhook-log.entity';

@Injectable()
export class SumsubWebhookHandler {
  private readonly logger = new Logger(SumsubWebhookHandler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
  ) {}

  async handleApplicantReviewed(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing Sumsub applicant reviewed webhook: ${payload.applicantId}`);

      await this.logWebhook('sumsub', 'applicant_reviewed', payload, 'success');

      const { applicantId, externalUserId, reviewResult } = payload;

      const user = await this.userRepository.findOne({
        where: [{ id: externalUserId }, { sumsubApplicantId: applicantId }],
      });

      if (!user) {
        this.logger.warn(
          `User not found for Sumsub webhook: ${externalUserId || applicantId}`,
        );
        return;
      }

      const previousStatus = user.kycStatus;

      if (reviewResult?.reviewAnswer === 'GREEN') {
        await this.handleKycApproved(user, payload);
      } else if (reviewResult?.reviewAnswer === 'RED') {
        await this.handleKycRejected(user, payload);
      } else if (reviewResult?.reviewAnswer === 'RETRY') {
        await this.handleKycRetry(user, payload);
      }

      this.logger.log(
        `KYC status updated for user ${user.id}: ${previousStatus} -> ${user.kycStatus}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle Sumsub applicant reviewed: ${error.message}`,
        error.stack,
      );
      await this.logWebhook('sumsub', 'applicant_reviewed', payload, 'failed', error.message);
      throw error;
    }
  }

  async handleApplicantPending(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing Sumsub applicant pending webhook: ${payload.applicantId}`);

      await this.logWebhook('sumsub', 'applicant_pending', payload, 'success');

      const { applicantId, externalUserId } = payload;

      const user = await this.userRepository.findOne({
        where: [{ id: externalUserId }, { sumsubApplicantId: applicantId }],
      });

      if (!user) {
        this.logger.warn(
          `User not found for Sumsub webhook: ${externalUserId || applicantId}`,
        );
        return;
      }

      if (user.kycStatus !== KycStatus.IN_REVIEW) {
        user.kycStatus = KycStatus.IN_REVIEW;
        await this.userRepository.save(user);

        await this.createAuditLog({
          userId: user.id,
          action: 'KYC_IN_REVIEW',
          entityType: 'User',
          entityId: user.id,
          metadata: { applicantId, reviewStatus: payload.reviewStatus },
        });

        this.logger.log(`KYC status updated to IN_REVIEW for user ${user.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle Sumsub applicant pending: ${error.message}`,
        error.stack,
      );
      await this.logWebhook('sumsub', 'applicant_pending', payload, 'failed', error.message);
      throw error;
    }
  }

  async handleApplicantCreated(payload: any): Promise<void> {
    try {
      this.logger.log(`Processing Sumsub applicant created webhook: ${payload.applicantId}`);

      await this.logWebhook('sumsub', 'applicant_created', payload, 'success');

      const { applicantId, externalUserId } = payload;

      const user = await this.userRepository.findOne({ where: { id: externalUserId } });

      if (!user) {
        this.logger.warn(`User not found for Sumsub webhook: ${externalUserId}`);
        return;
      }

      if (!user.sumsubApplicantId) {
        user.sumsubApplicantId = applicantId;
        user.kycStatus = KycStatus.IN_REVIEW;
        await this.userRepository.save(user);

        await this.createAuditLog({
          userId: user.id,
          action: 'KYC_APPLICANT_CREATED',
          entityType: 'User',
          entityId: user.id,
          metadata: { applicantId },
        });

        this.logger.log(`Sumsub applicant ${applicantId} linked to user ${user.id}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle Sumsub applicant created: ${error.message}`,
        error.stack,
      );
      await this.logWebhook('sumsub', 'applicant_created', payload, 'failed', error.message);
      throw error;
    }
  }

  private async handleKycApproved(user: User, payload: any): Promise<void> {
    user.kycStatus = KycStatus.APPROVED;
    user.kycApprovedAt = new Date();
    user.kycExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    await this.userRepository.save(user);

    await this.createAuditLog({
      userId: user.id,
      action: 'KYC_APPROVED',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        applicantId: payload.applicantId,
        reviewResult: payload.reviewResult,
      },
    });

    this.logger.log(`KYC approved for user: ${user.id}`);
  }

  private async handleKycRejected(user: User, payload: any): Promise<void> {
    user.kycStatus = KycStatus.REJECTED;
    user.kycApprovedAt = null;
    user.kycExpiresAt = null;

    await this.userRepository.save(user);

    await this.createAuditLog({
      userId: user.id,
      action: 'KYC_REJECTED',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        applicantId: payload.applicantId,
        reviewResult: payload.reviewResult,
        rejectLabels: payload.reviewResult?.rejectLabels,
        moderationComment: payload.reviewResult?.moderationComment,
      },
    });

    this.logger.log(`KYC rejected for user: ${user.id}`);
  }

  private async handleKycRetry(user: User, payload: any): Promise<void> {
    user.kycStatus = KycStatus.PENDING;

    await this.userRepository.save(user);

    await this.createAuditLog({
      userId: user.id,
      action: 'KYC_RETRY_REQUIRED',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        applicantId: payload.applicantId,
        reviewResult: payload.reviewResult,
      },
    });

    this.logger.log(`KYC retry required for user: ${user.id}`);
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
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }

  private async logWebhook(
    source: string,
    event: string,
    payload: any,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const webhookLog = this.webhookLogRepository.create({
        source,
        event,
        payload,
        status,
        errorMessage,
      });

      await this.webhookLogRepository.save(webhookLog);
    } catch (error) {
      this.logger.error(`Failed to log webhook: ${error.message}`);
    }
  }
}
