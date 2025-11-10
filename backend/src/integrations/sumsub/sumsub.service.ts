import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface SumsubConfig {
  appToken: string;
  secretKey: string;
  baseUrl: string;
  webhookSecret: string;
}

export interface CreateApplicantParams {
  externalUserId: string;
  email: string;
  phone?: string;
  fixedInfo?: {
    firstName?: string;
    lastName?: string;
    dob?: string; // YYYY-MM-DD
    country?: string;
  };
}

export interface ApplicantResponse {
  id: string;
  externalUserId: string;
  email: string;
  review: {
    reviewStatus: 'init' | 'pending' | 'prechecked' | 'queued' | 'completed' | 'onHold';
    reviewResult: {
      reviewAnswer: 'GREEN' | 'RED' | 'RETRY';
    };
  };
  createdAt: string;
}

export interface VerificationStatus {
  applicantId: string;
  status: 'pending' | 'approved' | 'rejected' | 'retry';
  reviewStatus: string;
  reviewResult: string;
  rejectLabels?: string[];
  moderationComment?: string;
}

export interface WebhookPayload {
  applicantId: string;
  inspectionId: string;
  correlationId: string;
  externalUserId: string;
  type: 'applicantReviewed' | 'applicantPending' | 'applicantCreated';
  reviewStatus: string;
  reviewResult: {
    reviewAnswer: string;
    rejectLabels?: string[];
    moderationComment?: string;
  };
  createdAt: string;
}

@Injectable()
export class SumsubService {
  private readonly logger = new Logger(SumsubService.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: SumsubConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      appToken: this.configService.get<string>('sumsub.appToken'),
      secretKey: this.configService.get<string>('sumsub.secretKey'),
      baseUrl: this.configService.get<string>('sumsub.baseUrl'),
      webhookSecret: this.configService.get<string>('sumsub.webhookSecret'),
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async createApplicant(params: CreateApplicantParams): Promise<ApplicantResponse> {
    try {
      this.logger.log(`Creating applicant for user: ${params.externalUserId}`);

      const path = '/resources/applicants';
      const body = {
        externalUserId: params.externalUserId,
        email: params.email,
        phone: params.phone,
        fixedInfo: params.fixedInfo,
      };

      const headers = this.generateHeaders('POST', path, body);

      const response = await this.httpClient.post(
        path,
        body,
        { headers },
      );

      this.logger.log(`Applicant created successfully: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create applicant: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getApplicantStatus(applicantId: string): Promise<VerificationStatus> {
    try {
      const path = `/resources/applicants/${applicantId}/status`;
      const headers = this.generateHeaders('GET', path);

      const response = await this.httpClient.get(path, { headers });

      const data = response.data;
      let status: 'pending' | 'approved' | 'rejected' | 'retry' = 'pending';

      if (data.reviewResult?.reviewAnswer === 'GREEN') {
        status = 'approved';
      } else if (data.reviewResult?.reviewAnswer === 'RED') {
        status = 'rejected';
      } else if (data.reviewResult?.reviewAnswer === 'RETRY') {
        status = 'retry';
      }

      return {
        applicantId,
        status,
        reviewStatus: data.reviewStatus,
        reviewResult: data.reviewResult?.reviewAnswer,
        rejectLabels: data.reviewResult?.rejectLabels,
        moderationComment: data.reviewResult?.moderationComment,
      };
    } catch (error) {
      this.logger.error(`Failed to get applicant status: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAccessToken(applicantId: string, levelName = 'basic-kyc-level'): Promise<string> {
    try {
      const path = `/resources/accessTokens`;
      const body = {
        userId: applicantId,
        levelName,
      };

      const headers = this.generateHeaders('POST', path, body);

      const response = await this.httpClient.post(
        path,
        body,
        { headers },
      );

      return response.data.token;
    } catch (error) {
      this.logger.error(`Failed to get access token: ${error.message}`, error.stack);
      throw error;
    }
  }

  async checkSanctions(applicantId: string): Promise<boolean> {
    try {
      const path = `/resources/applicants/${applicantId}/requiredIdDocsStatus`;
      const headers = this.generateHeaders('GET', path);

      const response = await this.httpClient.get(path, { headers });

      // Check if applicant is on sanctions list
      const sanctioned = response.data.some(
        (doc: any) =>
          doc.rejectLabels?.includes('SANCTIONS') ||
          doc.rejectLabels?.includes('ADVERSE_MEDIA'),
      );

      return sanctioned;
    } catch (error) {
      this.logger.error(`Failed to check sanctions: ${error.message}`, error.stack);
      return false;
    }
  }

  async resetApplicant(applicantId: string): Promise<void> {
    try {
      this.logger.log(`Resetting applicant: ${applicantId}`);

      const path = `/resources/applicants/${applicantId}/reset`;
      const headers = this.generateHeaders('POST', path);

      await this.httpClient.post(path, null, { headers });

      this.logger.log(`Applicant reset successfully: ${applicantId}`);
    } catch (error) {
      this.logger.error(`Failed to reset applicant: ${error.message}`, error.stack);
      throw error;
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error(`Failed to verify webhook signature: ${error.message}`);
      return false;
    }
  }

  private generateHeaders(
    method: string,
    path: string,
    body?: any,
  ): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    let bodyString = '';
    if (body) {
      bodyString = JSON.stringify(body);
    }

    const signString = `${timestamp}${method}${path}${bodyString}`;

    const signature = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(signString)
      .digest('hex');

    return {
      'X-App-Token': this.config.appToken,
      'X-App-Access-Ts': timestamp,
      'X-App-Access-Sig': signature,
    };
  }
}
