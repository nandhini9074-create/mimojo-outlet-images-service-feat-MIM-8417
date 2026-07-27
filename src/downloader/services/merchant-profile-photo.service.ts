import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { MerchantProfilePhoto } from '../models/merchant-profile-photo.entity';

@Injectable()
export class MerchantProfilePhotoService {
  constructor(
    @InjectModel(MerchantProfilePhoto)
    private readonly merchantProfilePhoto: typeof MerchantProfilePhoto,
    private readonly logger: CustomPinoLogger
  ) {}

  async insert(merchantProfileId: string, cdn_url: string, isDefault: boolean): Promise<any> {
    try {
      return await this.merchantProfilePhoto.create({
        merchantProfileMetadataId: merchantProfileId,
        cdnUrl: cdn_url,
        isActive: true,
        isDefault: isDefault || false,
      });
    } catch (error) {
      this.logger.error('MerchantProfilePhotoService.insert error', { error });
      throw new HttpException('Failed to insert the merchant profile image ', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async deselectDefaultImage(merchantProfileId: string) {
    try {
      return await this.merchantProfilePhoto.update(
        { isDefault: false },
        {
          where: { id: merchantProfileId },
        }
      );
    } catch (error) {
      this.logger.error('MerchantProfilePhotoService.deselectDefaultImage error', { error });
      throw new HttpException('Failed to deselect  the default image ', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateById(id: string, data: Partial<MerchantProfilePhoto>, transaction?: any) {
    this.logger.info('MerchantProfilePhotoService.updateById called', { id, data });
    try {
      const [count, rows] = await this.merchantProfilePhoto.update(data, {
        where: { id },
        returning: true,
        transaction,
      });
      if (count === 0) {
        throw new HttpException('MerchantProfilePhotoService.updateById no record found', HttpStatus.NOT_FOUND);
      }
      return rows[0];
    } catch (error) {
      // Re-throw HttpException as is
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('MerchantProfilePhotoService.updateById error', { error });
      throw new HttpException('MerchantProfilePhotoService.updateById failed', HttpStatus.BAD_REQUEST);
    }
  }
}
