import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus, OrderType } from '../../database/entities/order.entity';
import { User, KycStatus } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { BinanceService } from '../../integrations/binance/binance.service';
import { LedgerService } from '../ledger/ledger.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: Repository<Order>;
  let userRepository: Repository<User>;

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    kycStatus: KycStatus.APPROVED,
    isActive: true,
  };

  const mockOrder = {
    id: 'order-123',
    userId: '123',
    type: OrderType.BUY,
    cryptoAsset: 'USDT',
    fiatCurrency: 'AUD',
    cryptoAmount: '100',
    fiatAmount: '150',
    price: '1.5',
    status: OrderStatus.PENDING,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([mockOrder]),
            })),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
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
          provide: BinanceService,
          useValue: {
            createP2PAd: jest.fn().mockResolvedValue({ advNo: 'ADV123' }),
            deleteP2PAd: jest.fn().mockResolvedValue(undefined),
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

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an order for KYC approved user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(orderRepository, 'create').mockReturnValue(mockOrder as any);
      jest.spyOn(orderRepository, 'save').mockResolvedValue(mockOrder as any);

      const result = await service.create('123', {
        type: OrderType.BUY,
        cryptoAsset: 'USDT',
        fiatCurrency: 'AUD',
        cryptoAmount: '100',
        fiatAmount: '150',
        price: '1.5',
      });

      expect(result).toBeDefined();
      expect(orderRepository.create).toHaveBeenCalled();
      expect(orderRepository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-KYC approved user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        ...mockUser,
        kycStatus: KycStatus.PENDING,
      } as any);

      await expect(
        service.create('123', {
          type: OrderType.BUY,
          cryptoAsset: 'USDT',
          fiatCurrency: 'AUD',
          cryptoAmount: '100',
          fiatAmount: '150',
          price: '1.5',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create('123', {
          type: OrderType.BUY,
          cryptoAsset: 'USDT',
          fiatCurrency: 'AUD',
          cryptoAmount: '100',
          fiatAmount: '150',
          price: '1.5',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all orders for user', async () => {
      const result = await service.findAll('123');

      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findOne', () => {
    it('should return a single order', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(mockOrder as any);

      const result = await service.findOne('order-123', '123');

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('order-123', '123')).rejects.toThrow(NotFoundException);
    });
  });
});
