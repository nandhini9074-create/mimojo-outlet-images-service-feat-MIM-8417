import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IBlobConfig, IGoogleConfig } from 'config/interface';
import { UploadOuletImageDto } from 'src/uploader/dtos/upload-outlet-image.dto';
import { v4 as uuid } from 'uuid';
import { OutletSourceEnum } from '../enum/outlet-source-enum';
import { OutletPhotoService } from './outlet-photo.service';
//import axios from "axios";
import { InjectModel } from '@nestjs/sequelize';
import { extname } from 'path';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { UploadMerchantProfileImageDto } from 'src/uploader/dtos/upload-merchant-profile-photo.dto';
import { UploadMerchantImageDto } from 'src/uploader/dtos/upload-merchant.dto';
import { UploadOutletProfileImageDto } from 'src/uploader/dtos/upload-outlet-profile-image.dto';
import { UpdateMerchantHeroImageDto } from '../dtos/merchant-photo-dto';
import { MerchantPhoto } from '../models/merchant-photo.model';
import { MerchantProfileMetadata } from '../models/merchant-profile-metadata.model';
import { MerchantProfilePhoto } from '../models/merchant-profile-photo.entity';
import { OutletProfileMetadata } from '../models/outlet-profile.model';
import { MerchantPhotoService } from './merchant-photo.service';
import { MerchantProfilePhotoService } from './merchant-profile-photo.service';
import { OutletProfileMetadataService } from './outlet-profile-metadata.service';
import { OutletProfilePhotoService } from './outlet-profile-photos.service';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { EnvKeysEnum } from 'config/env.enum';
import { DataOperationsProducer } from 'src/kafka-service/data-operations.producer';
const axios = require('axios');

@Injectable()
export class DownloaderService {
  private readonly googleConfig: IGoogleConfig;
  private readonly blobConfig: IBlobConfig;
  constructor(
    private readonly outletPhotoService: OutletPhotoService,
    private readonly configService: ConfigService,
    private readonly merchantProfilePhotoService: MerchantProfilePhotoService,
    private readonly merchantPhotoService: MerchantPhotoService,
    private readonly outletProfilePhotoService: OutletProfilePhotoService,
    private readonly cdnUploadService: CdnUploadService,
    private readonly logger: CustomPinoLogger,
    @InjectModel(MerchantProfileMetadata) private readonly merchantProfileModel: typeof MerchantProfileMetadata,
    @InjectModel(OutletProfileMetadata) private readonly outletProfileModel: typeof OutletProfileMetadata,
    private readonly outletProfileMetadataService: OutletProfileMetadataService,
    private readonly dataOperationsProducer: DataOperationsProducer
  ) {
    this.googleConfig = this.configService.get('google');
    this.blobConfig = this.configService.get('blob');
  }

  async uploadImagesSync(model: UploadOuletImageDto): Promise<any> {
    return await this.uploadCustomImage(model.outletId, model.imageName, model.isDefault);
  }

  async uploadCustomImage(key: string, image: string, is_default: boolean): Promise<boolean> {
    //Uploading to cdn
    const validRegex = /^[.0-9a-zA-Z-_]+$/;
    if (!image || !validRegex.test(image)) {
      return false;
    }
    const cdnResponse = await this.cdnUploadService.uploadToCdn(
      `${this.blobConfig.BLOB_URL}/${image}?${this.blobConfig.BLOB_SAS_TOKEN}`
    );
    console.log('cdnResponse', cdnResponse);
    //Updating database
    const response = await this.insertOutletPhoto(key, JSON.parse(cdnResponse).result.variants[0], is_default);
    //Clearing Blob
    await this.deleteBlobFile(image);
    return response;
  }

  async uploadPoiImages(key: string, message: any) {
    console.log(this.configService);
    message.forEach(async photo => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/photo?photo_reference=${photo}&key=${this.googleConfig.GOOGLE_KEY}&maxwidth=600`;
        const headRes = await axios.head(url, { maxRedirects: 0, validateStatus: status => status >= 200 && status < 400 });
        const imageUrl = headRes.headers.location;

        console.log('Actual link: ', imageUrl);

        const fileType = '.jpg';
        const id: string = uuid();
        const fileName = `${id}${fileType}`;
        console.log('Blob Filename:', fileName);

        //Uploading to Blob
        const blobClient = this.getBlobClient(fileName);
        await blobClient.syncUploadFromURL(imageUrl);
        //Uploading to cdn
        const cdnResponse = await this.cdnUploadService.uploadToCdn(
          `${this.blobConfig.BLOB_URL}/${fileName}?${this.blobConfig.BLOB_SAS_TOKEN}`
        );
        console.log('cdnResponse', cdnResponse);
        //Updating database
        await this.insertOutletPhoto(key, JSON.parse(cdnResponse).result.variants[0], false);
        //Clearing Blob
        await this.deleteBlobFile(fileName);
      } catch (error) {
        this.logger.error('DownloaderService.uploadPoiImages error', { error });
        console.log('DownloaderService.uploadPoiImages error', { error });
      }
    });
  }

  async uploadService(header: any, key: string, message: any) {
    console.log('Header:', Buffer.from(header['imageSource']).toString('ascii'));
    console.log('Consumed Message: ', message);
    console.log(JSON.parse(message));

    if (Buffer.from(header['imageSource']).toString('ascii') === OutletSourceEnum.Custom) {
      await this.uploadCustomImage(key, JSON.parse(message).image, JSON.parse(message).is_default);
    } else {
      await this.uploadPoiImages(key, JSON.parse(message));
    }
  }

  getBlobClient(imageName: string): BlockBlobClient {
    const blobConnectionString = this.blobConfig.BLOB_CONNECTION_STRING;
    const blobClientService = BlobServiceClient.fromConnectionString(blobConnectionString);
    const containerClient = blobClientService.getContainerClient(this.blobConfig.BLOB_CONTAINER_NAME);
    const blobClient = containerClient.getBlockBlobClient(imageName);
    return blobClient;
  }

  private async insertOutletPhoto(outlet_id: string, cdn_url: string, is_default: boolean): Promise<any> {
    console.log('cdn update: ', outlet_id, cdn_url);
    return await this.outletPhotoService.insert(outlet_id, cdn_url, is_default);
  }

  private async deleteBlobFile(fileName: string): Promise<boolean> {
    const blobClient = this.getBlobClient(fileName);
    const response = await blobClient.deleteIfExists();
    return response.succeeded;
  }

  async uploadMerchantProfileImage(dto: UploadMerchantProfileImageDto, image: Express.Multer.File) {
    try {
      await this.ensureMerchantProfileExists(dto.merchantProfileId);
      if (dto?.setAsHeroImage?.toString() == 'true') {
        await this.merchantProfilePhotoService.deselectDefaultImage(dto.merchantProfileId);
      }
      const fileName = await this.uploadImageToBlob(image);
      const validRegex = /^[.0-9a-zA-Z-_]+$/;
      if (!fileName || !validRegex.test(fileName)) {
        return false;
      }
      const cdnResponse = await this.cdnUploadService.uploadToCdn(
        `${this.blobConfig.BLOB_URL}/${fileName}?${this.blobConfig.BLOB_SAS_TOKEN}`
      );
      const response = await this.insertMerchantProfilePhoto(
        dto.merchantProfileId,
        JSON.parse(cdnResponse).result.variants[0],
        dto.setAsHeroImage
      );
      await this.deleteBlobFile(fileName);
      return response;
    } catch (error) {
      this.logger.error('DownloaderService.uploadMerchantProfileImage error', { error });
      throw new HttpException(
        error?.response ?? 'Failed to upload the merchant profile image',
        error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  async uploadMerchantImage(dto: UploadMerchantImageDto, image: Express.Multer.File) {
    try {
      if (dto?.setAsHeroImage?.toString() == 'true') {
        await this.merchantPhotoService.deselectDefaultImage(dto.merchantId);
      }
      const fileName = await this.uploadImageToBlob(image);
      const validRegex = /^[.0-9a-zA-Z-_]+$/;
      if (!fileName || !validRegex.test(fileName)) {
        return false;
      }
      const cdnResponse = await this.cdnUploadService.uploadToCdn(
        `${this.blobConfig.BLOB_URL}/${fileName}?${this.blobConfig.BLOB_SAS_TOKEN}`
      );
      const response = await this.insertMerchantPhoto(
        dto.merchantId,
        JSON.parse(cdnResponse).result.variants[0],
        dto.setAsHeroImage
      );
      await this.deleteBlobFile(fileName);
      return response;
    } catch (error) {
      this.logger.error('DownloaderService.uploadMerchantProfileImage error', { error });
      throw new HttpException('Failed to upload the merchant profile image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async uploadOutletProfileImage(dto: UploadOutletProfileImageDto, image: Express.Multer.File) {
    try {
      await this.ensureOutletProfileExists(dto.outletProfileId);
      if (dto?.setAsHeroImage?.toString() == 'true') {
        await this.outletProfilePhotoService.deselectDefaultImage(dto.outletProfileId);
      }
      const fileName = await this.uploadImageToBlob(image);
      const validRegex = /^[.0-9a-zA-Z-_]+$/;
      if (!fileName || !validRegex.test(fileName)) {
        return false;
      }
      const cdnResponse = await this.cdnUploadService.uploadToCdn(
        `${this.blobConfig.BLOB_URL}/${fileName}?${this.blobConfig.BLOB_SAS_TOKEN}`
      );
      const response = await this.insertOutletProfilePhoto(
        dto.outletProfileId,
        JSON.parse(cdnResponse).result.variants[0],
        dto.setAsHeroImage
      );
      await this.deleteBlobFile(fileName);
      return response;
    } catch (error) {
      this.logger.error('DownloaderService.uploadOutletProfileImage error', { error });
      throw new HttpException(
        error?.response ?? 'Failed to upload the outlet profile image',
        error?.status ?? HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async uploadImageToBlob(image: Express.Multer.File) {
    if (image) {
      const id: string = uuid();
      const fileName = `${id}${extname(image.originalname)}`;
      const blobClient = this.getBlobClient(fileName);
      await blobClient.uploadData(image.buffer);
      return fileName;
    }
  }
  private async insertMerchantProfilePhoto(merchantProfileId: string, cdnUrl: string, isDefault: boolean) {
    return await this.merchantProfilePhotoService.insert(merchantProfileId, cdnUrl, isDefault);
  }

  private async insertMerchantPhoto(merchantId: string, cdnUrl: string, isDefault: boolean) {
    return await this.merchantPhotoService.insert(merchantId, cdnUrl, isDefault);
  }
  private async insertOutletProfilePhoto(outletProfileId: string, cdnUrl: string, isDefault: boolean) {
    return await this.outletProfilePhotoService.insert(outletProfileId, cdnUrl, isDefault);
  }
  private async ensureMerchantProfileExists(merchantProfileId: string) {
    try {
      if (!merchantProfileId) {
        throw new HttpException('Merchant profile metadata does not exist', HttpStatus.NOT_FOUND);
      }
      const count = await this.merchantProfileModel.count({
        where: {
          id: merchantProfileId,
        },
      });
      if (count === 0) {
        throw new HttpException('Merchant profile metadata does not exist', HttpStatus.NOT_FOUND);
      }
      return count;
    } catch (error) {
      throw new HttpException('Merchant profile metadata does not exist', HttpStatus.NOT_FOUND);
    }
  }
  private async ensureOutletProfileExists(outletProfileId: string) {
    try {
      if (!outletProfileId) {
        throw new HttpException('Outlet profile metadata does not exist', HttpStatus.NOT_FOUND);
      }
      const count = await this.outletProfileModel.count({
        where: {
          id: outletProfileId,
        },
      });
      if (count === 0) {
        throw new HttpException('Outlet profile metadata does not exist', HttpStatus.NOT_FOUND);
      }
      return count;
    } catch (error) {
      throw new HttpException('Outlet profile metadata does not exist', HttpStatus.NOT_FOUND);
    }
  }

  async markMerchantHeroImage(dto: UpdateMerchantHeroImageDto): Promise<any> {
    this.logger.info('DownloaderService.markMerchantHeroImage called', { dto });
    try {
      if (dto.profileId) {
        if (dto.existingHeroImageId) await this.merchantProfilePhotoService.deselectDefaultImage(dto.existingHeroImageId);
        const response: MerchantProfilePhoto = await this.merchantProfilePhotoService.updateById(dto.newHeroImageId, {
          isDefault: dto.setAsHeroImage,
        });
        await this.updateOutletProfileHeroImage(dto, response.cdnUrl);
      } else {
        if (dto.merchantId) await this.merchantPhotoService.deselectDefaultImage(dto.merchantId);
        const response: MerchantPhoto = await this.merchantPhotoService.updateById(dto.newHeroImageId, {
          isDefault: dto.setAsHeroImage,
        });
        await this.updateOutletHeroImage(dto, response.cdnUrl);
      }
      this.logger.info('DownloaderService.markMerchantHeroImage completed', {
        id: dto.newHeroImageId,
        setAsHeroImage: dto.setAsHeroImage,
      });
      return { message: 'Merchant hero image updated successfully' };
    } catch (error) {
      this.logger.error('DownloaderService.markMerchantHeroImage error', { error });
      throw new HttpException('Failed to update the merchant hero image', HttpStatus.BAD_REQUEST);
    }
  }

  private async updateOutletProfileHeroImage(dto: UpdateMerchantHeroImageDto, cdnUrl: string) {
    this.logger.info('DownloaderService.updateOutletProfileHeroImage called', { dto, cdnUrl });
    const outletProfileIds = await this.outletProfileMetadataService.getOutletProfileIdMerchantId(
      dto.merchantId,
      dto.profileId
    );
    await this.outletProfilePhotoService.bulkDelete(outletProfileIds);
    await this.outletProfilePhotoService.bulkInsert(outletProfileIds, cdnUrl, dto.setAsHeroImage);
  }

  private async updateOutletHeroImage(dto: UpdateMerchantHeroImageDto, cdnUrl: string) {
    this.logger.info('DownloaderService.updateOutletHeroImage called', { dto, cdnUrl });
    const outletIds = await this.outletProfileMetadataService.getOutletIdMerchantId(dto.merchantId);
    await this.outletPhotoService.bulkDelete(outletIds);
    const outletImages = await this.outletPhotoService.bulkInsert(outletIds, cdnUrl, dto.setAsHeroImage);

    for (const outletImage of outletImages) {
      // Audit Log : node_name = Hero Image
      this.dataOperationsProducer.pushToAuditLogService(
        'mimojo-outlet-image-service',
        {
          status: 'COMPLETED',
          values: outletImage,
        },
        {
          audit_main_node_configuration_id: process.env[EnvKeysEnum.AUDIT_LOG_NODE_HERO_IMAGE],
        }
      );
    }
  }
}
