import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { OutletProfileMetadata } from '../models/outlet-profile.model';

@Injectable()
export class OutletProfileMetadataService {
  constructor(
    @InjectModel(OutletProfileMetadata)
    private readonly outletProfileMetadataModel: typeof OutletProfileMetadata,
    private readonly logger: CustomPinoLogger
  ) {}

  async getOutletIdMerchantId(merchantId: string): Promise<string[]> {
    this.logger.info('OutletProfileMetadataService.getOutletIdMerchantId called', { merchantId });
    try {
      const outletIds = await this.outletProfileMetadataModel.findAll({ attributes: ['outletId'], where: { merchantId } });
      return [...new Set(outletIds.map(o => o.outletId))];
    } catch (error) {
      this.logger.error('OutletProfileMetadataService.getOutletIdMerchantId failed', error);
      throw new HttpException('OutletProfileMetadataService.getOutletIdMerchantId failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getOutletProfileIdMerchantId(merchantId: string, profileId: string): Promise<string[]> {
    this.logger.info('OutletProfileMetadataService.getOutletProfileIdMerchantId called', { merchantId, profileId });
    try {
      const outletProfileIds = await this.outletProfileMetadataModel.findAll({
        attributes: ['id'],
        where: { merchantId, profileId },
      });
      return [...new Set(outletProfileIds.map(o => o.id))];
    } catch (error) {
      this.logger.error('OutletProfileMetadataService.getOutletProfileIdMerchantId failed', error);
      throw new HttpException(
        'OutletProfileMetadataService.getOutletProfileIdMerchantId failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
