import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { OutletProfilePhotos } from '../models/outlet-profile-photos';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { Op } from 'sequelize';

@Injectable()
export class OutletProfilePhotoService {
  constructor(
    @InjectModel(OutletProfilePhotos)
    private readonly outletProfilePhotoModel: typeof OutletProfilePhotos,
    private readonly logger: CustomPinoLogger
  ) {}

  async insert(outletProfileId: string, cdn_url: string, isDefault: boolean): Promise<any> {
    try {
      const createdData = await this.outletProfilePhotoModel.create({
        outletProfileMetadataId: outletProfileId,
        cdnUrl: cdn_url,
        isActive: true,
        isDefault: isDefault ? isDefault : false,
      });
      const result = {
        ...createdData.get({ plain: true }),
        outletPhotoId: createdData.id,
      };
      return result;
    } catch (error) {
      this.logger.error('OutletProfilePhotoService.insert error', { error });
      throw new HttpException('Failed to insert the outlet profile image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async deselectDefaultImage(outletProfileId: string) {
    try {
      return await this.outletProfilePhotoModel.update(
        { isDefault: false },
        {
          where: { outletProfileMetadataId: outletProfileId },
        }
      );
    } catch (error) {
      this.logger.error('OutletProfilePhotoService.deselectDefaultImage error', { error });
      throw new HttpException('Failed to deselect the default image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkDelete(outletProfileMetadataIds: string[]) {
    this.logger.info('OutletProfilePhotoService.bulkDelete called', { outletProfileMetadataIds });
    try {
      return await this.outletProfilePhotoModel.destroy({
        where: { outletProfileMetadataId: { [Op.in]: outletProfileMetadataIds }, isDefault: true, isActive: true },
      });
    } catch (error) {
      this.logger.error('OutletProfilePhotoService.bulkDelete error', { error });
      throw new HttpException('Failed to bulkDelete the default image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async bulkInsert(outletProfileMetadataIds: string[], cdn_url: string, is_default: boolean) {
    this.logger.info('OutletProfilePhotoService.bulkInsert called', { outletProfileMetadataIds });
    try {
      const records = outletProfileMetadataIds.map(outletProfileMetadataId => ({
        outletProfileMetadataId,
        cdnUrl: cdn_url,
        isDefault: is_default,
        isActive: true,
      }));
      return await this.outletProfilePhotoModel.bulkCreate(records);
    } catch (error) {
      this.logger.error('OutletProfilePhotoService.bulkInsert error', { error });
      throw new HttpException('Failed to insert the default image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
