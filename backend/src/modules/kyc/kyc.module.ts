import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { User } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SumsubService } from '../../integrations/sumsub/sumsub.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog])],
  controllers: [KycController],
  providers: [KycService, SumsubService],
  exports: [KycService],
})
export class KycModule {}
