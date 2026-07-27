import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { MerchantPhoto } from '../models/merchant-photo.model';

@Injectable()
export class MerchantPhotoService {
  constructor(
    @InjectModel(MerchantPhoto)
    private readonly merchantPhotoModel: typeof MerchantPhoto,
    private readonly logger: CustomPinoLogger
  ) {}

  async insert(merchantId: string, cdn_url: string, isDefault: boolean): Promise<any> {
    try {
      return await this.merchantPhotoModel.create({
        merchantId: merchantId,
        cdnUrl: cdn_url,
        isActive: true,
        isDefault: isDefault ? isDefault : false,
      });
    } catch (error) {
      console.log(error);
      this.logger.error('MerchantPhotoService.insert error', { error });
      throw new HttpException('Failed to insert the merchant  image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async deselectDefaultImage(merchantId: string) {
    try {
      return await this.merchantPhotoModel.update(
        { isDefault: false },
        {
          where: { merchantId: merchantId },
        }
      );
    } catch (error) {
      this.logger.error('MerchantPhotoService.deselectDefaultImage error', { error });
      throw new HttpException('Failed to deselect  the default  image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateById(id: string, data: Partial<MerchantPhoto>, transaction?: any) {
    this.logger.info('MerchantPhotoService.updateById called', { id, data });
    try {
      const [count, rows] = await this.merchantPhotoModel.update(data, {
        where: { id },
        returning: true,
        transaction,
      });
      if (count === 0) {
        throw new HttpException('MerchantPhotoService.updateById no record found', HttpStatus.NOT_FOUND);
      }
      return rows[0];
    } catch (error) {
      // Re-throw HttpException as is
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('MerchantPhotoService.updateById error', { error });
      throw new HttpException('MerchantPhotoService.updateById failed', HttpStatus.BAD_REQUEST);
    }
  }
}
