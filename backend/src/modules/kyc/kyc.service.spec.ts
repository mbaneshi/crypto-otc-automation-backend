import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycService } from './kyc.service';
import { User, KycStatus } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SumsubService } from '../../integrations/sumsub/sumsub.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('KycService', () => {
  let service: KycService;
  let userRepository: Repository<User>;
  let sumsubService: SumsubService;

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    kycStatus: KycStatus.PENDING,
    sumsubApplicantId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: SumsubService,
          useValue: {
            createApplicant: jest.fn().mockResolvedValue({ id: 'applicant-123' }),
            getAccessToken: jest.fn().mockResolvedValue('access-token'),
            getApplicantStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
            checkSanctions: jest.fn().mockResolvedValue(false),
            resetApplicant: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    sumsubService = module.get<SumsubService>(SumsubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateKyc', () => {
    it('should initiate KYC for new user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);

      const result = await service.initiateKyc('123');

      expect(result).toHaveProperty('applicantId');
      expect(result).toHaveProperty('accessToken');
      expect(sumsubService.createApplicant).toHaveBeenCalled();
    });

    it('should return existing applicant if already created', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        ...mockUser,
        sumsubApplicantId: 'applicant-123',
      } as any);

      const result = await service.initiateKyc('123');

      expect(result.applicantId).toBe('applicant-123');
      expect(sumsubService.createApplicant).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if KYC already approved', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        ...mockUser,
        kycStatus: KycStatus.APPROVED,
      } as any);

      await expect(service.initiateKyc('123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getKycStatus', () => {
    it('should return KYC status', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.getKycStatus('123');

      expect(result).toHaveProperty('status');
      expect(result.status).toBe(KycStatus.PENDING);
    });
  });

  describe('checkSanctions', () => {
    it('should check sanctions for user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        ...mockUser,
        sumsubApplicantId: 'applicant-123',
      } as any);

      const result = await service.checkSanctions('123');

      expect(result).toHaveProperty('isSanctioned');
      expect(result.isSanctioned).toBe(false);
    });

    it('should throw BadRequestException if KYC not initiated', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      await expect(service.checkSanctions('123')).rejects.toThrow(BadRequestException);
    });
  });
});
