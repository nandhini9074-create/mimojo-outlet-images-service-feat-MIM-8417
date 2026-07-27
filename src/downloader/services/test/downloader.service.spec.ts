import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UploadOuletImageDto } from 'src/uploader/dtos/upload-outlet-image.dto';
import { UploadMerchantImageDto } from 'src/uploader/dtos/upload-merchant.dto';
import { UploadOutletProfileImageDto } from 'src/uploader/dtos/upload-outlet-profile-image.dto';

import axios from 'axios';
import { UploadMerchantProfileImageDto } from 'src/uploader/dtos/upload-merchant-profile-photo.dto';
import { DownloaderService } from '../downloader.service';
import { MerchantPhotoService } from '../merchant-photo.service';
import { MerchantProfilePhotoService } from '../merchant-profile-photo.service';
import { OutletPhotoService } from '../outlet-photo.service';
import { OutletProfilePhotoService } from '../outlet-profile-photos.service';
import { getModelToken } from '@nestjs/sequelize';
import { MerchantProfileMetadata } from 'src/downloader/models/merchant-profile-metadata.model';
import { OutletProfileMetadata } from 'src/downloader/models/outlet-profile.model';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { OutletProfileMetadataService } from '../outlet-profile-metadata.service';
import { UpdateMerchantHeroImageDto } from 'src/downloader/dtos/merchant-photo-dto';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { DataOperationsProducer } from 'src/kafka-service/data-operations.producer';
import { EnvKeysEnum } from 'config/env.enum';

// Mock dependencies
jest.mock('axios');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));
jest.mock('@azure/storage-blob');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DownloaderService', () => {
  let service: DownloaderService;
  let mockOutletPhotoService: jest.Mocked<OutletPhotoService>;
  let mockMerchantProfilePhotoService: jest.Mocked<MerchantProfilePhotoService>;
  let mockMerchantPhotoService: jest.Mocked<MerchantPhotoService>;
  let mockOutletProfilePhotoService: jest.Mocked<OutletProfilePhotoService>;
  let mockOutletProfileMetadataService: jest.Mocked<OutletProfileMetadataService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockCdnUploadService: jest.Mocked<CdnUploadService>;
  let mockDataOperationsProducer: jest.Mocked<DataOperationsProducer>;
  let mockLogger: any;
  let mockBlobClient: any;

  const mockConfigs = {
    google: { GOOGLE_KEY: 'test-google-key' },
    blob: {
      BLOB_URL: 'https://test-blob.com',
      BLOB_SAS_TOKEN: 'test-sas-token',
      BLOB_CONNECTION_STRING: 'test-connection-string',
      BLOB_CONTAINER_NAME: 'test-container',
    },
    cdn: {
      CDN_LINK: 'https://test-cdn.com',
      CDN_AUTHORIZATION: 'Bearer test-token',
    },
  };

  beforeEach(async () => {
    mockCdnUploadService = {
      uploadToCdn: jest.fn().mockResolvedValue(JSON.stringify({ result: { variants: ['https://cdn.com/image.jpg'] } })),
    } as unknown as jest.Mocked<CdnUploadService>;
    mockDataOperationsProducer = {
      pushToAuditLogService: jest.fn(),
    } as unknown as jest.Mocked<DataOperationsProducer>;

    // Mock blob client
    mockBlobClient = {
      syncUploadFromURL: jest.fn().mockResolvedValue({}),
      uploadData: jest.fn().mockResolvedValue({}),
      deleteIfExists: jest.fn().mockResolvedValue({ succeeded: true }),
    };

    // Mock Azure Blob Storage
    const mockContainerClient = {
      getBlockBlobClient: jest.fn().mockReturnValue(mockBlobClient),
    };

    const mockBlobServiceClient = {
      getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
    };

    const mockMerchantProfileModel = {
      count: jest.fn().mockResolvedValue(1),
    };
    const mockOutletProfileModel = {
      count: jest.fn().mockResolvedValue(1),
    };

    const BlobServiceClient = require('@azure/storage-blob').BlobServiceClient;
    BlobServiceClient.fromConnectionString = jest.fn().mockReturnValue(mockBlobServiceClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DownloaderService,
        {
          provide: OutletPhotoService,
          useValue: {
            insert: jest.fn(),
            bulkDelete: jest.fn(),
            bulkInsert: jest.fn(),
          },
        },
        {
          provide: MerchantProfilePhotoService,
          useValue: {
            insert: jest.fn(),
            deselectDefaultImage: jest.fn().mockResolvedValue([1]),
            updateById: jest.fn(),
          },
        },
        {
          provide: MerchantPhotoService,
          useValue: {
            insert: jest.fn(),
            deselectDefaultImage: jest.fn().mockResolvedValue([1]),
            updateById: jest.fn(),
          },
        },
        {
          provide: OutletProfilePhotoService,
          useValue: {
            insert: jest.fn(),
            deselectDefaultImage: jest.fn().mockResolvedValue([1]),
            bulkDelete: jest.fn(),
            bulkInsert: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(key => mockConfigs[key]),
          },
        },
        {
          provide: CustomPinoLogger,
          useValue: {
            error: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
          },
        },
        {
          provide: getModelToken(MerchantProfileMetadata),
          useValue: mockMerchantProfileModel,
        },
        {
          provide: getModelToken(OutletProfileMetadata),
          useValue: mockOutletProfileModel,
        },
        {
          provide: OutletProfileMetadataService,
          useValue: {
            getOutletProfileIdMerchantId: jest.fn(),
            getOutletIdMerchantId: jest.fn(),
          },
        },
        {
          provide: CdnUploadService,
          useValue: mockCdnUploadService,
        },
        {
          provide: DataOperationsProducer,
          useValue: mockDataOperationsProducer,
        },
      ],
    }).compile();

    service = module.get<DownloaderService>(DownloaderService);
    mockOutletPhotoService = module.get(OutletPhotoService);
    mockMerchantProfilePhotoService = module.get(MerchantProfilePhotoService);
    mockMerchantPhotoService = module.get(MerchantPhotoService);
    mockOutletProfilePhotoService = module.get(OutletProfilePhotoService);
    mockOutletProfileMetadataService = module.get(OutletProfileMetadataService);
    mockConfigService = module.get(ConfigService);
    mockLogger = module.get(CustomPinoLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadImagesSync', () => {
    it('should upload custom image successfully', async () => {
      const dto: UploadOuletImageDto = {
        outletId: 'outlet-123',
        imageName: 'test-image.jpg',
        isDefault: true,
      };

      jest.spyOn(service, 'uploadCustomImage').mockResolvedValue(true);

      const result = await service.uploadImagesSync(dto);

      expect(result).toBe(true);
      expect(service.uploadCustomImage).toHaveBeenCalledWith(dto.outletId, dto.imageName, dto.isDefault);
    });
  });

  describe('uploadCustomImage', () => {
    it('should upload custom image successfully', async () => {
      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.com/image.jpg'] } })
      );

      mockOutletPhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      const result = await service.uploadCustomImage('outlet-123', 'test-image.jpg', true);

      expect(result).toEqual({ id: 'photo-123' });
      expect(mockBlobClient.deleteIfExists).toHaveBeenCalledWith();
    });

    it('should return false for invalid image name', async () => {
      const result = await service.uploadCustomImage('outlet-123', 'invalid@image.jpg', true);
      expect(result).toBe(false);
    });

    it('should return false for empty image name', async () => {
      const result = await service.uploadCustomImage('outlet-123', '', true);
      expect(result).toBe(false);
    });
  });

  describe('uploadService', () => {
    it('should handle custom image upload', async () => {
      const header = { imageSource: 'Custom' };
      const message = JSON.stringify({ image: 'hero.jpg', is_default: true });

      jest.spyOn(service, 'uploadCustomImage').mockResolvedValue(true);

      await service.uploadService(header, 'outlet-123', message);

      expect(service.uploadCustomImage).toHaveBeenCalledWith('outlet-123', 'hero.jpg', true);
    });

    it('should handle POI images upload', async () => {
      const header = { imageSource: Buffer.from('POI').toString('base64') };
      const message = JSON.stringify(['photo-ref-1', 'photo-ref-2']);

      jest.spyOn(service, 'uploadPoiImages').mockResolvedValue();

      await service.uploadService(header, 'outlet-123', message);

      expect(service.uploadPoiImages).toHaveBeenCalledWith('outlet-123', ['photo-ref-1', 'photo-ref-2']);
    });
  });

  describe('uploadPoiImages', () => {
    const flushPromises = async () => {
      await new Promise(process.nextTick);
      await new Promise(process.nextTick);
    };

    it('should fetch/upload poi image and cleanup blob', async () => {
      mockedAxios.head.mockResolvedValue({
        headers: { location: 'https://maps.googleapis.com/actual-image.jpg' },
      } as any);
      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.com/poi-image.jpg'] } })
      );
      mockOutletPhotoService.insert.mockResolvedValue({ id: 'poi-photo-1' });

      await service.uploadPoiImages('outlet-123', ['poi-photo-ref']);
      await flushPromises();

      expect(mockedAxios.head).toHaveBeenCalled();
      expect(mockBlobClient.syncUploadFromURL).toHaveBeenCalledWith('https://maps.googleapis.com/actual-image.jpg');
      expect(mockOutletPhotoService.insert).toHaveBeenCalledWith('outlet-123', 'https://cdn.com/poi-image.jpg', false);
      expect(mockBlobClient.deleteIfExists).toHaveBeenCalled();
    });

    it('should log error when poi upload fails', async () => {
      mockedAxios.head.mockRejectedValue(new Error('Google API unavailable'));

      await service.uploadPoiImages('outlet-123', ['poi-photo-ref']);
      await flushPromises();

      expect(mockLogger.error).toHaveBeenCalledWith('DownloaderService.uploadPoiImages error', {
        error: expect.any(Error),
      });
    });
  });

  describe('uploadMerchantProfileImage', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test image data'),
      size: 1024,
      stream: null,
      destination: '',
      filename: '',
      path: '',
    };

    it('should upload merchant profile image successfully', async () => {
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: 'merchant-profile-123',
        setAsHeroImage: true,
      };

      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.com/image.jpg'] } })
      );

      mockMerchantProfilePhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantProfilePhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      const result = await service.uploadMerchantProfileImage(dto, mockFile);

      expect(result).toEqual({ id: 'photo-123' });
      expect(mockMerchantProfilePhotoService.deselectDefaultImage).toHaveBeenCalledWith(dto.merchantProfileId);
      expect(mockBlobClient.uploadData).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('should not deselect default image when setAsHeroImage is false', async () => {
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: 'merchant-profile-123',
        setAsHeroImage: false,
      };

      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.com/image.jpg'] } })
      );

      mockMerchantProfilePhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      await service.uploadMerchantProfileImage(dto, mockFile);

      expect(mockMerchantProfilePhotoService.deselectDefaultImage).not.toHaveBeenCalled();
    });

    it('should throw HttpException on error', async () => {
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: 'merchant-profile-123',
        setAsHeroImage: true,
      };

      mockBlobClient.uploadData.mockRejectedValue(new Error('Upload failed'));

      await expect(service.uploadMerchantProfileImage(dto, mockFile)).rejects.toThrow(
        new HttpException('Failed to upload the merchant profile image', HttpStatus.INTERNAL_SERVER_ERROR)
      );

      expect(mockLogger.error).toHaveBeenCalledWith('DownloaderService.uploadMerchantProfileImage error', {
        error: expect.any(Error),
      });
    });
    it('should return false when fileName is null', async () => {
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: 'merchant-profile-123',
        setAsHeroImage: true,
      };

      jest.spyOn(service as any, 'uploadImageToBlob').mockResolvedValue(null as any);

      // Ensure other calls don't interfere
      jest.spyOn((service as any)['cdnUploadService'], 'uploadToCdn').mockResolvedValue('');
      jest.spyOn(service as any, 'insertMerchantProfilePhoto').mockResolvedValue(null);
      jest.spyOn(service as any, 'deleteBlobFile').mockResolvedValue(undefined);

      const result = await service.uploadMerchantProfileImage(dto, mockFile);

      expect(result).toBe(false);
    });
    it('should return false when fileName is invalid', async () => {
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: 'merchant-profile-123',
        setAsHeroImage: true,
      };

      jest.spyOn(service as any, 'uploadImageToBlob').mockResolvedValue('invalid*file$name.jpg');

      // Prevent other methods from running unexpectedly
      jest.spyOn((service as any)['cdnUploadService'], 'uploadToCdn').mockResolvedValue('');
      jest.spyOn(service as any, 'insertMerchantProfilePhoto').mockResolvedValue(null);
      jest.spyOn(service as any, 'deleteBlobFile').mockResolvedValue(undefined);

      const result = await service.uploadMerchantProfileImage(dto, mockFile);

      expect(result).toBe(false);
    });
  });

  describe('uploadMerchantImage', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test image data'),
      size: 1024,
      stream: null,
      destination: '',
      filename: '',
      path: '',
    };

    it('should upload merchant image successfully', async () => {
      const dto: UploadMerchantImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
      };

      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.com/image.jpg'] } })
      );

      mockMerchantPhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantPhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      const result = await service.uploadMerchantImage(dto, mockFile);

      expect(result).toEqual({ id: 'photo-123' });
      expect(mockMerchantPhotoService.deselectDefaultImage).toHaveBeenCalledWith(dto.merchantId);
    });

    it('should handle upload error', async () => {
      const dto: UploadMerchantImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: false,
      };

      mockBlobClient.uploadData.mockRejectedValue(new Error('Upload failed'));

      await expect(service.uploadMerchantImage(dto, mockFile)).rejects.toThrow(
        new HttpException('Failed to upload the merchant profile image', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });
    it('should return false when fileName is null', async () => {
      const dto: UploadMerchantImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: false,
      };

      jest.spyOn(service as any, 'uploadImageToBlob').mockResolvedValue(null as any);

      // Ensure other calls don't interfere
      jest.spyOn((service as any)['cdnUploadService'], 'uploadToCdn').mockResolvedValue('');
      jest.spyOn(service as any, 'insertMerchantPhoto').mockResolvedValue(null);
      jest.spyOn(service as any, 'deleteBlobFile').mockResolvedValue(undefined);

      const result = await service.uploadMerchantImage(dto, mockFile);

      expect(result).toBe(false);
    });
    it('should return false when fileName is invalid', async () => {
      const dto: UploadMerchantImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: false,
      };

      jest.spyOn(service as any, 'uploadImageToBlob').mockResolvedValue('invalid*file$name.jpg');

      // Prevent other methods from running unexpectedly
      jest.spyOn((service as any)['cdnUploadService'], 'uploadToCdn').mockResolvedValue('');
      jest.spyOn(service as any, 'insertMerchantPhoto').mockResolvedValue(null);
      jest.spyOn(service as any, 'deleteBlobFile').mockResolvedValue(undefined);

      const result = await service.uploadMerchantImage(dto, mockFile);

      expect(result).toBe(false);
    });
  });

  describe('uploadOutletProfileImage', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test image data'),
      size: 1024,
      stream: null,
      destination: '',
      filename: '',
      path: '',
    };

    it('should upload outlet profile image successfully', async () => {
      const dto: UploadOutletProfileImageDto = {
        outletProfileId: 'outlet-profile-123',
        setAsHeroImage: true,
      };

      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.com/image.jpg'] } })
      );

      mockOutletProfilePhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockOutletProfilePhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      const result = await service.uploadOutletProfileImage(dto, mockFile);

      expect(result).toEqual({ id: 'photo-123' });
      expect(mockOutletProfilePhotoService.deselectDefaultImage).toHaveBeenCalledWith(dto.outletProfileId);
    });

    it('should handle upload error', async () => {
      const dto: UploadOutletProfileImageDto = {
        outletProfileId: 'outlet-profile-123',
        setAsHeroImage: false,
      };

      mockBlobClient.uploadData.mockRejectedValue(new Error('Upload failed'));

      await expect(service.uploadOutletProfileImage(dto, mockFile)).rejects.toThrow(
        new HttpException('Failed to upload the outlet profile image', HttpStatus.INTERNAL_SERVER_ERROR)
      );
    });
    it('should return false when fileName is null', async () => {
      const dto: UploadOutletProfileImageDto = {
        outletProfileId: 'outlet-profile-123',
        setAsHeroImage: false,
      };

      jest.spyOn(service as any, 'uploadImageToBlob').mockResolvedValue(null as any);

      // Ensure other calls don't interfere
      jest.spyOn((service as any)['cdnUploadService'], 'uploadToCdn').mockResolvedValue('');
      jest.spyOn(service as any, 'insertOutletProfilePhoto').mockResolvedValue(null);
      jest.spyOn(service as any, 'deleteBlobFile').mockResolvedValue(undefined);

      const result = await service.uploadOutletProfileImage(dto, mockFile);

      expect(result).toBe(false);
    });
    it('should return false when fileName is invalid', async () => {
      const dto: UploadOutletProfileImageDto = {
        outletProfileId: 'outlet-profile-123',
        setAsHeroImage: false,
      };

      jest.spyOn(service as any, 'uploadImageToBlob').mockResolvedValue('invalid*file$name.jpg');

      // Prevent other methods from running unexpectedly
      jest.spyOn((service as any)['cdnUploadService'], 'uploadToCdn').mockResolvedValue('');
      jest.spyOn(service as any, 'insertOutletProfilePhoto').mockResolvedValue(null);
      jest.spyOn(service as any, 'deleteBlobFile').mockResolvedValue(undefined);

      const result = await service.uploadOutletProfileImage(dto, mockFile);

      expect(result).toBe(false);
    });
  });

  describe('getBlobClient', () => {
    it('should return blob client', () => {
      const result = service.getBlobClient('test-image.jpg');
      expect(result).toBe(mockBlobClient);
    });
  });

  describe('deleteBlobFile', () => {
    it('should delete blob file successfully', async () => {
      mockBlobClient.deleteIfExists.mockResolvedValue({ succeeded: true });

      const result = await service['deleteBlobFile']('test-image.jpg');
      expect(result).toBe(true);
    });

    it('should handle delete failure', async () => {
      mockBlobClient.deleteIfExists.mockResolvedValue({ succeeded: false });

      const result = await service['deleteBlobFile']('test-image.jpg');
      expect(result).toBe(false);
    });
  });

  describe('uploadImageToBlob', () => {
    it('should upload image to blob successfully', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'image',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test image data'),
        size: 1024,
        stream: null,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service['uploadImageToBlob'](mockFile);
      expect(result).toBe('mock-uuid-123.jpg');
      expect(mockBlobClient.uploadData).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('should handle undefined image', async () => {
      const result = await service['uploadImageToBlob'](undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('insert methods', () => {
    it('should insert outlet photo', async () => {
      mockOutletPhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      const result = await service['insertOutletPhoto']('outlet-123', 'https://cdn.com/image.jpg', true);
      expect(result).toEqual({ id: 'photo-123' });
      expect(mockOutletPhotoService.insert).toHaveBeenCalledWith('outlet-123', 'https://cdn.com/image.jpg', true);
    });

    it('should insert merchant profile photo', async () => {
      mockMerchantProfilePhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      const result = await service['insertMerchantProfilePhoto']('merchant-profile-123', 'https://cdn.com/image.jpg', true);
      expect(result).toEqual({ id: 'photo-123' });
    });

    it('should insert merchant photo', async () => {
      mockMerchantPhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      const result = await service['insertMerchantPhoto']('merchant-123', 'https://cdn.com/image.jpg', true);
      expect(result).toEqual({ id: 'photo-123' });
    });

    it('should insert outlet profile photo', async () => {
      mockOutletProfilePhotoService.insert.mockResolvedValue({ id: 'photo-123' });

      const result = await service['insertOutletProfilePhoto']('outlet-profile-123', 'https://cdn.com/image.jpg', true);
      expect(result).toEqual({ id: 'photo-123' });
    });
  });

  describe('markMerchantHeroImage', () => {
    it('should mark merchant hero image with profileId successfully', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
      };

      const mockMerchantProfilePhoto = {
        id: 'new-image-789',
        cdnUrl: 'https://cdn.com/new-hero.jpg',
        isDefault: true,
      };

      mockMerchantProfilePhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantProfilePhotoService.updateById.mockResolvedValue(mockMerchantProfilePhoto as any);
      mockOutletProfileMetadataService.getOutletProfileIdMerchantId.mockResolvedValue([
        'outlet-profile-1',
        'outlet-profile-2',
      ]);
      mockOutletProfilePhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletProfilePhotoService.bulkInsert.mockResolvedValue(undefined);

      const result = await service.markMerchantHeroImage(dto);

      expect(result).toEqual({ message: 'Merchant hero image updated successfully' });
      expect(mockLogger.info).toHaveBeenCalledWith('DownloaderService.markMerchantHeroImage called', { dto });
      expect(mockMerchantProfilePhotoService.deselectDefaultImage).toHaveBeenCalledWith(dto.existingHeroImageId);
      expect(mockMerchantProfilePhotoService.updateById).toHaveBeenCalledWith(dto.newHeroImageId, {
        isDefault: dto.setAsHeroImage,
      });
      expect(mockOutletProfileMetadataService.getOutletProfileIdMerchantId).toHaveBeenCalledWith(
        dto.merchantId,
        dto.profileId
      );
      expect(mockOutletProfilePhotoService.bulkDelete).toHaveBeenCalledWith(['outlet-profile-1', 'outlet-profile-2']);
      expect(mockOutletProfilePhotoService.bulkInsert).toHaveBeenCalledWith(
        ['outlet-profile-1', 'outlet-profile-2'],
        mockMerchantProfilePhoto.cdnUrl,
        dto.setAsHeroImage
      );
      expect(mockLogger.info).toHaveBeenCalledWith('DownloaderService.markMerchantHeroImage completed', {
        id: dto.newHeroImageId,
        setAsHeroImage: dto.setAsHeroImage,
      });
    });

    it('should mark merchant hero image without profileId successfully', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };

      const mockMerchantPhoto = {
        id: 'new-image-789',
        cdnUrl: 'https://cdn.com/new-hero.jpg',
        isDefault: true,
      };

      mockMerchantPhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantPhotoService.updateById.mockResolvedValue(mockMerchantPhoto as any);
      mockOutletProfileMetadataService.getOutletIdMerchantId.mockResolvedValue(['outlet-1', 'outlet-2', 'outlet-3']);
      mockOutletPhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletPhotoService.bulkInsert.mockResolvedValue([]);

      const result = await service.markMerchantHeroImage(dto);

      expect(result).toEqual({ message: 'Merchant hero image updated successfully' });
      expect(mockMerchantPhotoService.deselectDefaultImage).toHaveBeenCalledWith(dto.merchantId);
      expect(mockMerchantPhotoService.updateById).toHaveBeenCalledWith(dto.newHeroImageId, {
        isDefault: dto.setAsHeroImage,
      });
      expect(mockOutletProfileMetadataService.getOutletIdMerchantId).toHaveBeenCalledWith(dto.merchantId);
      expect(mockOutletPhotoService.bulkDelete).toHaveBeenCalledWith(['outlet-1', 'outlet-2', 'outlet-3']);
      expect(mockOutletPhotoService.bulkInsert).toHaveBeenCalledWith(
        ['outlet-1', 'outlet-2', 'outlet-3'],
        mockMerchantPhoto.cdnUrl,
        dto.setAsHeroImage
      );
    });

    it('should mark merchant hero image with profileId without existing hero image', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: undefined,
      };

      const mockMerchantProfilePhoto = {
        id: 'new-image-789',
        cdnUrl: 'https://cdn.com/new-hero.jpg',
        isDefault: true,
      };

      mockMerchantProfilePhotoService.updateById.mockResolvedValue(mockMerchantProfilePhoto as any);
      mockOutletProfileMetadataService.getOutletProfileIdMerchantId.mockResolvedValue(['outlet-profile-1']);
      mockOutletProfilePhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletProfilePhotoService.bulkInsert.mockResolvedValue(undefined);

      const result = await service.markMerchantHeroImage(dto);

      expect(result).toEqual({ message: 'Merchant hero image updated successfully' });
      expect(mockMerchantProfilePhotoService.deselectDefaultImage).not.toHaveBeenCalled();
      expect(mockMerchantProfilePhotoService.updateById).toHaveBeenCalledWith(dto.newHeroImageId, {
        isDefault: dto.setAsHeroImage,
      });
    });

    it('should handle unmark (setAsHeroImage=false) with profileId', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: false,
        newHeroImageId: 'image-789',
        existingHeroImageId: 'old-hero-101',
      };

      const mockMerchantProfilePhoto = {
        id: 'image-789',
        cdnUrl: 'https://cdn.com/image.jpg',
        isDefault: false,
      };

      mockMerchantProfilePhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantProfilePhotoService.updateById.mockResolvedValue(mockMerchantProfilePhoto as any);
      mockOutletProfileMetadataService.getOutletProfileIdMerchantId.mockResolvedValue(['outlet-profile-1']);
      mockOutletProfilePhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletProfilePhotoService.bulkInsert.mockResolvedValue(undefined);

      const result = await service.markMerchantHeroImage(dto);

      expect(result).toEqual({ message: 'Merchant hero image updated successfully' });
      expect(mockMerchantProfilePhotoService.updateById).toHaveBeenCalledWith(dto.newHeroImageId, {
        isDefault: false,
      });
    });

    it('should handle unmark (setAsHeroImage=false) without profileId', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: false,
        newHeroImageId: 'image-789',
        existingHeroImageId: 'old-hero-101',
        profileId: undefined,
      };

      const mockMerchantPhoto = {
        id: 'image-789',
        cdnUrl: 'https://cdn.com/image.jpg',
        isDefault: false,
      };

      mockMerchantPhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantPhotoService.updateById.mockResolvedValue(mockMerchantPhoto as any);
      mockOutletProfileMetadataService.getOutletIdMerchantId.mockResolvedValue(['outlet-1']);
      mockOutletPhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletPhotoService.bulkInsert.mockResolvedValue([]);

      const result = await service.markMerchantHeroImage(dto);

      expect(result).toEqual({ message: 'Merchant hero image updated successfully' });
      expect(mockMerchantPhotoService.updateById).toHaveBeenCalledWith(dto.newHeroImageId, {
        isDefault: false,
      });
    });

    it('should handle error when updating merchant profile photo fails', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
      };

      mockMerchantProfilePhotoService.updateById.mockRejectedValue(new Error('Database error'));

      await expect(service.markMerchantHeroImage(dto)).rejects.toThrow(
        new HttpException('Failed to update the merchant hero image', HttpStatus.BAD_REQUEST)
      );
      expect(mockLogger.error).toHaveBeenCalledWith('DownloaderService.markMerchantHeroImage error', {
        error: expect.any(Error),
      });
    });

    it('should handle error when updating merchant photo fails', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };

      mockMerchantPhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantPhotoService.updateById.mockRejectedValue(new Error('Photo not found'));

      await expect(service.markMerchantHeroImage(dto)).rejects.toThrow(
        new HttpException('Failed to update the merchant hero image', HttpStatus.BAD_REQUEST)
      );
      expect(mockLogger.error).toHaveBeenCalledWith('DownloaderService.markMerchantHeroImage error', {
        error: expect.any(Error),
      });
    });

    it('should handle error when outlet profile photo bulk operations fail', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
      };

      const mockMerchantProfilePhoto = {
        id: 'new-image-789',
        cdnUrl: 'https://cdn.com/new-hero.jpg',
        isDefault: true,
      };

      mockMerchantProfilePhotoService.updateById.mockResolvedValue(mockMerchantProfilePhoto as any);
      mockOutletProfileMetadataService.getOutletProfileIdMerchantId.mockRejectedValue(new Error('Metadata service error'));

      await expect(service.markMerchantHeroImage(dto)).rejects.toThrow(
        new HttpException('Failed to update the merchant hero image', HttpStatus.BAD_REQUEST)
      );
    });

    it('should handle error when outlet photo bulk operations fail', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };

      const mockMerchantPhoto = {
        id: 'new-image-789',
        cdnUrl: 'https://cdn.com/new-hero.jpg',
        isDefault: true,
      };

      mockMerchantPhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantPhotoService.updateById.mockResolvedValue(mockMerchantPhoto as any);
      mockOutletProfileMetadataService.getOutletIdMerchantId.mockRejectedValue(new Error('Outlet service error'));

      await expect(service.markMerchantHeroImage(dto)).rejects.toThrow(
        new HttpException('Failed to update the merchant hero image', HttpStatus.BAD_REQUEST)
      );
    });

    it('should handle empty outlet profile IDs array', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
      };

      const mockMerchantProfilePhoto = {
        id: 'new-image-789',
        cdnUrl: 'https://cdn.com/new-hero.jpg',
        isDefault: true,
      };

      mockMerchantProfilePhotoService.updateById.mockResolvedValue(mockMerchantProfilePhoto as any);
      mockOutletProfileMetadataService.getOutletProfileIdMerchantId.mockResolvedValue([]);
      mockOutletProfilePhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletProfilePhotoService.bulkInsert.mockResolvedValue(undefined);

      const result = await service.markMerchantHeroImage(dto);

      expect(result).toEqual({ message: 'Merchant hero image updated successfully' });
      expect(mockOutletProfilePhotoService.bulkDelete).toHaveBeenCalledWith([]);
      expect(mockOutletProfilePhotoService.bulkInsert).toHaveBeenCalledWith([], mockMerchantProfilePhoto.cdnUrl, true);
    });

    it('should handle empty outlet IDs array', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };

      const mockMerchantPhoto = {
        id: 'new-image-789',
        cdnUrl: 'https://cdn.com/new-hero.jpg',
        isDefault: true,
      };

      mockMerchantPhotoService.deselectDefaultImage.mockResolvedValue([1]);
      mockMerchantPhotoService.updateById.mockResolvedValue(mockMerchantPhoto as any);
      mockOutletProfileMetadataService.getOutletIdMerchantId.mockResolvedValue([]);
      mockOutletPhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletPhotoService.bulkInsert.mockResolvedValue([]);

      const result = await service.markMerchantHeroImage(dto);

      expect(result).toEqual({ message: 'Merchant hero image updated successfully' });
      expect(mockOutletPhotoService.bulkDelete).toHaveBeenCalledWith([]);
      expect(mockOutletPhotoService.bulkInsert).toHaveBeenCalledWith([], mockMerchantPhoto.cdnUrl, true);
    });
  });

  describe('updateOutletProfileHeroImage (private method)', () => {
    it('should update outlet profile hero images successfully', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
      };
      const cdnUrl = 'https://cdn.com/hero-image.jpg';
      const outletProfileIds = ['outlet-profile-1', 'outlet-profile-2', 'outlet-profile-3'];

      mockOutletProfileMetadataService.getOutletProfileIdMerchantId.mockResolvedValue(outletProfileIds);
      mockOutletProfilePhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletProfilePhotoService.bulkInsert.mockResolvedValue(undefined);

      await service['updateOutletProfileHeroImage'](dto, cdnUrl);

      expect(mockOutletProfileMetadataService.getOutletProfileIdMerchantId).toHaveBeenCalledWith(
        dto.merchantId,
        dto.profileId
      );
      expect(mockOutletProfilePhotoService.bulkDelete).toHaveBeenCalledWith(outletProfileIds);
      expect(mockOutletProfilePhotoService.bulkInsert).toHaveBeenCalledWith(outletProfileIds, cdnUrl, dto.setAsHeroImage);
    });

    it('should handle single outlet profile ID', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
      };
      const cdnUrl = 'https://cdn.com/hero-image.jpg';
      const outletProfileIds = ['outlet-profile-1'];

      mockOutletProfileMetadataService.getOutletProfileIdMerchantId.mockResolvedValue(outletProfileIds);
      mockOutletProfilePhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletProfilePhotoService.bulkInsert.mockResolvedValue(undefined);

      await service['updateOutletProfileHeroImage'](dto, cdnUrl);

      expect(mockOutletProfilePhotoService.bulkDelete).toHaveBeenCalledWith(outletProfileIds);
      expect(mockOutletProfilePhotoService.bulkInsert).toHaveBeenCalledWith(outletProfileIds, cdnUrl, true);
    });

    it('should handle setAsHeroImage=false', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        profileId: 'profile-456',
        setAsHeroImage: false,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
      };
      const cdnUrl = 'https://cdn.com/hero-image.jpg';
      const outletProfileIds = ['outlet-profile-1', 'outlet-profile-2'];

      mockOutletProfileMetadataService.getOutletProfileIdMerchantId.mockResolvedValue(outletProfileIds);
      mockOutletProfilePhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletProfilePhotoService.bulkInsert.mockResolvedValue(undefined);

      await service['updateOutletProfileHeroImage'](dto, cdnUrl);

      expect(mockOutletProfilePhotoService.bulkInsert).toHaveBeenCalledWith(outletProfileIds, cdnUrl, false);
    });
  });

  describe('updateOutletHeroImage (private method)', () => {
    it('should push audit logs for each inserted outlet image', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };
      const cdnUrl = 'https://cdn.com/hero-image.jpg';
      const outletIds = ['outlet-1', 'outlet-2'];
      const outletImages = [{ id: 'image-1' }, { id: 'image-2' }];
      process.env[EnvKeysEnum.AUDIT_LOG_NODE_HERO_IMAGE] = 'hero-node-config-id';

      mockOutletProfileMetadataService.getOutletIdMerchantId.mockResolvedValue(outletIds);
      mockOutletPhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletPhotoService.bulkInsert.mockResolvedValue(outletImages as any);

      await service['updateOutletHeroImage'](dto, cdnUrl);

      expect(mockDataOperationsProducer.pushToAuditLogService).toHaveBeenCalledTimes(2);
      expect(mockDataOperationsProducer.pushToAuditLogService).toHaveBeenNthCalledWith(
        1,
        'mimojo-outlet-image-service',
        { status: 'COMPLETED', values: outletImages[0] },
        { audit_main_node_configuration_id: 'hero-node-config-id' }
      );
    });

    it('should update outlet hero images successfully', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };
      const cdnUrl = 'https://cdn.com/hero-image.jpg';
      const outletIds = ['outlet-1', 'outlet-2', 'outlet-3', 'outlet-4'];

      mockOutletProfileMetadataService.getOutletIdMerchantId.mockResolvedValue(outletIds);
      mockOutletPhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletPhotoService.bulkInsert.mockResolvedValue([]);

      await service['updateOutletHeroImage'](dto, cdnUrl);

      expect(mockOutletProfileMetadataService.getOutletIdMerchantId).toHaveBeenCalledWith(dto.merchantId);
      expect(mockOutletPhotoService.bulkDelete).toHaveBeenCalledWith(outletIds);
      expect(mockOutletPhotoService.bulkInsert).toHaveBeenCalledWith(outletIds, cdnUrl, dto.setAsHeroImage);
    });

    it('should handle single outlet ID', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };
      const cdnUrl = 'https://cdn.com/hero-image.jpg';
      const outletIds = ['outlet-1'];

      mockOutletProfileMetadataService.getOutletIdMerchantId.mockResolvedValue(outletIds);
      mockOutletPhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletPhotoService.bulkInsert.mockResolvedValue([]);

      await service['updateOutletHeroImage'](dto, cdnUrl);

      expect(mockOutletPhotoService.bulkDelete).toHaveBeenCalledWith(outletIds);
      expect(mockOutletPhotoService.bulkInsert).toHaveBeenCalledWith(outletIds, cdnUrl, true);
    });

    it('should handle setAsHeroImage=false', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-123',
        setAsHeroImage: false,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };
      const cdnUrl = 'https://cdn.com/hero-image.jpg';
      const outletIds = ['outlet-1', 'outlet-2'];

      mockOutletProfileMetadataService.getOutletIdMerchantId.mockResolvedValue(outletIds);
      mockOutletPhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletPhotoService.bulkInsert.mockResolvedValue([]);

      await service['updateOutletHeroImage'](dto, cdnUrl);

      expect(mockOutletPhotoService.bulkInsert).toHaveBeenCalledWith(outletIds, cdnUrl, false);
    });

    it('should handle empty outlet IDs array', async () => {
      const dto: UpdateMerchantHeroImageDto = {
        merchantId: 'merchant-no-outlets',
        setAsHeroImage: true,
        newHeroImageId: 'new-image-789',
        existingHeroImageId: 'old-image-101',
        profileId: undefined,
      };
      const cdnUrl = 'https://cdn.com/hero-image.jpg';
      const outletIds: string[] = [];

      mockOutletProfileMetadataService.getOutletIdMerchantId.mockResolvedValue(outletIds);
      mockOutletPhotoService.bulkDelete.mockResolvedValue(undefined);
      mockOutletPhotoService.bulkInsert.mockResolvedValue([]);

      await service['updateOutletHeroImage'](dto, cdnUrl);

      expect(mockOutletPhotoService.bulkDelete).toHaveBeenCalledWith([]);
      expect(mockOutletPhotoService.bulkInsert).toHaveBeenCalledWith([], cdnUrl, true);
    });
  });

  describe('metadata existence guards', () => {
    it('ensureMerchantProfileExists should throw when merchantProfileId is empty', async () => {
      await expect(service['ensureMerchantProfileExists']('')).rejects.toThrow(
        new HttpException('Merchant profile metadata does not exist', HttpStatus.NOT_FOUND)
      );
    });

    it('ensureMerchantProfileExists should throw when count is zero', async () => {
      const merchantProfileModel = (service as any).merchantProfileModel;
      merchantProfileModel.count.mockResolvedValue(0);

      await expect(service['ensureMerchantProfileExists']('merchant-profile-123')).rejects.toThrow(
        new HttpException('Merchant profile metadata does not exist', HttpStatus.NOT_FOUND)
      );
    });

    it('ensureMerchantProfileExists should throw when count query fails', async () => {
      const merchantProfileModel = (service as any).merchantProfileModel;
      merchantProfileModel.count.mockRejectedValue(new Error('db down'));

      await expect(service['ensureMerchantProfileExists']('merchant-profile-123')).rejects.toThrow(
        new HttpException('Merchant profile metadata does not exist', HttpStatus.NOT_FOUND)
      );
    });

    it('ensureOutletProfileExists should throw when outletProfileId is empty', async () => {
      await expect(service['ensureOutletProfileExists']('')).rejects.toThrow(
        new HttpException('Outlet profile metadata does not exist', HttpStatus.NOT_FOUND)
      );
    });

    it('ensureOutletProfileExists should throw when count is zero', async () => {
      const outletProfileModel = (service as any).outletProfileModel;
      outletProfileModel.count.mockResolvedValue(0);

      await expect(service['ensureOutletProfileExists']('outlet-profile-123')).rejects.toThrow(
        new HttpException('Outlet profile metadata does not exist', HttpStatus.NOT_FOUND)
      );
    });

    it('ensureOutletProfileExists should throw when count query fails', async () => {
      const outletProfileModel = (service as any).outletProfileModel;
      outletProfileModel.count.mockRejectedValue(new Error('db down'));

      await expect(service['ensureOutletProfileExists']('outlet-profile-123')).rejects.toThrow(
        new HttpException('Outlet profile metadata does not exist', HttpStatus.NOT_FOUND)
      );
    });
  });
});
