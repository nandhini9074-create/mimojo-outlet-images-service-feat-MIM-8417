import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { OutletPhoto } from '../models/outlet-photo.model';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { Op } from 'sequelize';

@Injectable()
export class OutletPhotoService {
  constructor(
    @InjectModel(OutletPhoto)
    private readonly outletPhotoModel: typeof OutletPhoto,
    private readonly logger: CustomPinoLogger
  ) {}

  async insert(outlet_id: string, cdn_url: string, is_default: boolean): Promise<any> {
    return await this.outletPhotoModel.create({
      outletId: outlet_id,
      cdnUrl: cdn_url,
      isDefault: is_default,
      isActive: true,
    });
  }

  async bulkDelete(outletIds: string[]) {
    this.logger.info('OutletPhotoService.bulkDelete called', { outletIds });
    if (!outletIds?.length) {
      this.logger.warn('bulkDelete called with empty outletIds');
      return 0;
    }
    try {
      const deletedCount = await this.outletPhotoModel.destroy({
        where: {
          outletId: { [Op.in]: outletIds },
          isDefault: true,
          isActive: true,
        },
      });
      return deletedCount;
    } catch (error) {
      this.logger.error('OutletPhotoService.bulkDelete error', { error });
      throw new HttpException('Failed to delete the default image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkInsert(outletIds: string[], cdn_url: string, is_default: boolean): Promise<OutletPhoto[] | []> {
    this.logger.info('OutletPhotoService.bulkInsert called', { outletIds });
    if (!outletIds?.length) {
      this.logger.warn('bulkInsert called with empty outletIds');
      return [];
    }
    try {
      const records = outletIds.map(outletId => ({
        outletId,
        cdnUrl: cdn_url,
        isDefault: is_default,
        isActive: true,
      }));
      return await this.outletPhotoModel.bulkCreate(records);
    } catch (error) {
      this.logger.error('OutletPhotoService.bulkInsert error', { error });
      throw new HttpException('Failed to insert the default image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
