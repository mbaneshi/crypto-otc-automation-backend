import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus, PaymentMethod } from '../../database/entities/payment.entity';
import { Order, OrderStatus } from '../../database/entities/order.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { NPPService } from '../../integrations/npp/npp.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: Repository<Payment>;
  let orderRepository: Repository<Order>;

  const mockOrder = {
    id: 'order-123',
    userId: '123',
    status: OrderStatus.BINANCE_AD_CREATED,
  };

  const mockPayment = {
    id: 'payment-123',
    orderId: 'order-123',
    amount: '150',
    currency: 'AUD',
    status: PaymentStatus.PENDING,
    paymentMethod: PaymentMethod.NPP,
    order: mockOrder,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([mockPayment]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Order),
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
          provide: NPPService,
          useValue: {
            initiatePayment: jest.fn().mockResolvedValue({ transactionId: 'NPP123' }),
            refundPayment: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: LedgerService,
          useValue: {
            recordTransaction: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a payment', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(mockOrder as any);
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(paymentRepository, 'create').mockReturnValue(mockPayment as any);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue(mockPayment as any);
      jest.spyOn(orderRepository, 'save').mockResolvedValue(mockOrder as any);

      const result = await service.create('123', {
        orderId: 'order-123',
        amount: '150',
        currency: 'AUD',
        paymentMethod: PaymentMethod.NPP,
      });

      expect(result).toBeDefined();
      expect(paymentRepository.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent order', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create('123', {
          orderId: 'order-123',
          amount: '150',
          currency: 'AUD',
          paymentMethod: PaymentMethod.NPP,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if pending payment exists', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(mockOrder as any);
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment as any);

      await expect(
        service.create('123', {
          orderId: 'order-123',
          amount: '150',
          currency: 'AUD',
          paymentMethod: PaymentMethod.NPP,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all payments for user', async () => {
      const result = await service.findAll('123');

      expect(result).toEqual([mockPayment]);
    });
  });
});
