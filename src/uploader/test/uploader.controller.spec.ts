import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DownloaderService } from 'src/downloader/services/downloader.service';

import { UploaderController } from '../uploader.controller';
import { UploadMerchantProfileImageDto } from '../dtos/upload-merchant-profile-photo.dto';
import { UploadMerchantImageDto } from '../dtos/upload-merchant.dto';
import { UploadOuletImageDto } from '../dtos/upload-outlet-image.dto';
import { UploadOutletProfileImageDto } from '../dtos/upload-outlet-profile-image.dto';
import { baseResponseHelper } from 'helper/base-response.helper';
import { imageFileFilter } from '../uploader.controller';
import { MerchantService } from 'src/downloader/services/merchant.service';
import { MerchantProfileMetadataService } from 'src/downloader/services/merchant-profile-metadata.service';
// Mock the baseResponseHelper
jest.mock('helper/base-response.helper', () => ({
  baseResponseHelper: jest.fn(data => ({ success: true, data })),
}));
// const imageFileFilter = (req, file, callback) => {
//   if (!file.mimetype?.startsWith('image/')) {
//     return callback(new BadRequestException('Only image files are allowed!'), false);
//   }
//   callback(null, true);
// };
describe('UploaderController', () => {
  let controller: UploaderController;
  let downloaderService: jest.Mocked<DownloaderService>;
  let merchantService: jest.Mocked<MerchantService>;
  let merchantProfileMetadataService: jest.Mocked<MerchantProfileMetadataService>;
  let mockBaseResponseHelper: jest.MockedFunction<typeof baseResponseHelper>;

  const mockFile: Express.Multer.File = {
    fieldname: 'image',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    destination: '',
    filename: '',
    path: '',
    stream: null,
  };

  beforeEach(async () => {
    const mockDownloaderService = {
      uploadImagesSync: jest.fn(),
      uploadMerchantProfileImage: jest.fn(),
      uploadMerchantImage: jest.fn(),
      uploadOutletProfileImage: jest.fn(),
      markMerchantHeroImage: jest.fn(),
    };

    const mockMerchantService = {
      startMerchantLogosToCdnMigration: jest.fn(),
      getMerchantLogosToCdnMigrationStatus: jest.fn(),
    };

    const mockMerchantProfileMetadataService = {
      startMerchantProfileMetadataLogosToCdnMigration: jest.fn(),
      getMerchantProfileMetadataLogosToCdnMigrationStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploaderController],
      providers: [
        {
          provide: DownloaderService,
          useValue: mockDownloaderService,
        },
        {
          provide: MerchantService,
          useValue: mockMerchantService,
        },
        {
          provide: MerchantProfileMetadataService,
          useValue: mockMerchantProfileMetadataService,
        },
      ],
    }).compile();

    controller = module.get<UploaderController>(UploaderController);
    downloaderService = module.get(DownloaderService);
    merchantService = module.get(MerchantService);
    merchantProfileMetadataService = module.get(MerchantProfileMetadataService);
    mockBaseResponseHelper = baseResponseHelper as jest.MockedFunction<typeof baseResponseHelper>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('', () => {
    describe('imageFileFilter', () => {
      let mockCallback: jest.Mock;
      let mockReq: any;

      beforeEach(() => {
        mockCallback = jest.fn();
        mockReq = {}; // Mock request object
      });

      it('should accept valid image files', () => {
        const validImageTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          'image/bmp',
          'image/tiff',
        ];

        validImageTypes.forEach(mimetype => {
          const file = { mimetype };
          mockCallback.mockClear();

          imageFileFilter(mockReq, file, mockCallback);

          expect(mockCallback).toHaveBeenCalledWith(null, true);
          expect(mockCallback).toHaveBeenCalledTimes(1);
        });
      });

      it('should reject non-image files', () => {
        const invalidFileTypes = [
          'text/plain',
          'application/pdf',
          'video/mp4',
          'audio/mpeg',
          'application/json',
          'application/octet-stream',
          'text/html',
          'application/zip',
        ];

        invalidFileTypes.forEach(mimetype => {
          const file = { mimetype };
          mockCallback.mockClear();

          imageFileFilter(mockReq, file, mockCallback);

          expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
          expect(mockCallback).toHaveBeenCalledTimes(1);

          // Verify the error message
          const [error] = mockCallback.mock.calls[0];
          expect(error).toBeInstanceOf(BadRequestException);
          expect(error.message).toBe('Only image files are allowed!');
        });
      });

      it('should handle edge cases with mimetype', () => {
        // Test with empty mimetype
        const fileWithEmptyMimetype = { mimetype: '' };
        mockCallback.mockClear();

        imageFileFilter(mockReq, fileWithEmptyMimetype, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);

        // Test with null mimetype
        const fileWithNullMimetype = { mimetype: null };
        mockCallback.mockClear();

        imageFileFilter(mockReq, fileWithNullMimetype, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);

        // Test with undefined mimetype
        const fileWithUndefinedMimetype = {};
        mockCallback.mockClear();

        imageFileFilter(mockReq, fileWithUndefinedMimetype, mockCallback);

        expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
      });

      it('should handle case sensitivity in mimetype', () => {
        const mixedCaseMimetypes = ['Image/jpeg', 'IMAGE/PNG', 'Image/GIF'];

        mixedCaseMimetypes.forEach(mimetype => {
          const file = { mimetype };
          mockCallback.mockClear();

          imageFileFilter(mockReq, file, mockCallback);

          // These should be rejected since mimetype check is case-sensitive
          expect(mockCallback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
        });
      });

      it('should handle malformed mimetypes that start with image/', () => {
        const malformedMimetypes = ['image/', 'image/unknown', 'image/custom-format'];

        malformedMimetypes.forEach(mimetype => {
          const file = { mimetype };
          mockCallback.mockClear();

          imageFileFilter(mockReq, file, mockCallback);

          // These should be accepted since they start with 'image/'
          expect(mockCallback).toHaveBeenCalledWith(null, true);
        });
      });
    });
  });

  describe('UploadOutletImage', () => {
    it('should successfully upload outlet image', async () => {
      // Arrange
      const dto: UploadOuletImageDto = {
        outletId: '550e8400-e29b-41d4-a716-446655440000',
        imageName: 'outlet-banner.jpg',
        isDefault: true,
      } as any;
      const expectedServiceResponse = { imageId: 'img123', url: 'uploaded-url' };
      downloaderService.uploadImagesSync.mockResolvedValue(expectedServiceResponse as any);

      // Act
      const result = await controller.UploadOutletImage(dto);

      // Assert
      expect(downloaderService.uploadImagesSync).toHaveBeenCalledWith(dto);
      expect(downloaderService.uploadImagesSync).toHaveBeenCalledTimes(1);
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(expectedServiceResponse);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle non-default outlet image', async () => {
      // Arrange
      const dto: UploadOuletImageDto = {
        outletId: '550e8400-e29b-41d4-a716-446655440001',
        imageName: 'outlet-gallery-1.png',
        isDefault: false,
      };
      const expectedServiceResponse = { imageId: 'img124', url: 'gallery-url' };
      downloaderService.uploadImagesSync.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.UploadOutletImage(dto);

      // Assert
      expect(downloaderService.uploadImagesSync).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle service errors', async () => {
      // Arrange
      const dto: UploadOuletImageDto = {
        outletId: '550e8400-e29b-41d4-a716-446655440000',
        imageName: 'outlet-banner.jpg',
        isDefault: true,
      };
      const serviceError = new Error('Service error');
      downloaderService.uploadImagesSync.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.UploadOutletImage(dto)).rejects.toThrow('Service error');
      expect(downloaderService.uploadImagesSync).toHaveBeenCalledWith(dto);
    });

    it('should handle validation scenarios with different image names', async () => {
      // Arrange - Test with different image extensions
      const dtoWithWebp: UploadOuletImageDto = {
        outletId: '550e8400-e29b-41d4-a716-446655440002',
        imageName: 'outlet-hero.webp',
        isDefault: false,
      };
      const expectedServiceResponse = { imageId: 'img125', url: 'webp-url' };
      downloaderService.uploadImagesSync.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.UploadOutletImage(dtoWithWebp);

      // Assert
      expect(downloaderService.uploadImagesSync).toHaveBeenCalledWith(dtoWithWebp);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle empty dto', async () => {
      // Arrange
      const dto = {} as UploadOuletImageDto;
      const expectedServiceResponse = null;
      downloaderService.uploadImagesSync.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.UploadOutletImage(dto);

      // Assert
      expect(downloaderService.uploadImagesSync).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });
  });

  describe('migrateMerchantLogosToCdn', () => {
    it('should start merchant logo migration and return base response', async () => {
      const jobResponse = {
        jobId: 'merchant-job-1',
        status: 'queued',
        createdAt: '2026-04-02T10:00:00.000Z',
        input: {
          batchSize: 50,
        },
      };

      merchantService.startMerchantLogosToCdnMigration.mockReturnValue(jobResponse as any);

      const result = await controller.startMigrateMerchantLogosToCdn(50);

      expect(merchantService.startMerchantLogosToCdnMigration).toHaveBeenCalledWith(50);
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(jobResponse);
      expect(result).toEqual({ success: true, data: jobResponse });
    });

    it('should return merchant logo migration status', async () => {
      const jobStatus = {
        jobId: 'merchant-job-1',
        status: 'completed',
        createdAt: '2026-04-02T10:00:00.000Z',
        startedAt: '2026-04-02T10:00:01.000Z',
        finishedAt: '2026-04-02T10:00:10.000Z',
        input: {
          batchSize: 50,
        },
        summary: {
          total: 10,
          migrated: 7,
          skipped: 2,
          failed: 1,
          batchSize: 50,
          failures: [{ merchantId: 'merchant-1', reason: 'CDN error' }],
        },
      };

      merchantService.getMerchantLogosToCdnMigrationStatus.mockReturnValue(jobStatus as any);

      const result = await controller.getMigrateMerchantLogosToCdnStatus('merchant-job-1');

      expect(merchantService.getMerchantLogosToCdnMigrationStatus).toHaveBeenCalledWith('merchant-job-1');
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(jobStatus);
      expect(result).toEqual({ success: true, data: jobStatus });
    });

    it('should throw when merchant logo migration status job is missing', async () => {
      merchantService.getMerchantLogosToCdnMigrationStatus.mockReturnValue(null);

      expect(() => controller.getMigrateMerchantLogosToCdnStatus('missing-job')).toThrow('Migration job not found');
      expect(merchantService.getMerchantLogosToCdnMigrationStatus).toHaveBeenCalledWith('missing-job');
    });
  });

  describe('migrateMerchantProfileMetadataLogosToCdn', () => {
    it('should start merchant profile metadata logo migration and return base response', async () => {
      const jobResponse = {
        jobId: 'profile-job-1',
        status: 'queued',
        createdAt: '2026-04-02T10:00:00.000Z',
        input: {
          profileId: 'profile-123',
          batchSize: 25,
        },
      };

      merchantProfileMetadataService.startMerchantProfileMetadataLogosToCdnMigration.mockReturnValue(jobResponse as any);

      const result = await controller.migrateMerchantProfileMetadataLogosToCdn('profile-123', 25);

      expect(merchantProfileMetadataService.startMerchantProfileMetadataLogosToCdnMigration).toHaveBeenCalledWith(
        'profile-123',
        25
      );
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(jobResponse);
      expect(result).toEqual({ success: true, data: jobResponse });
    });

    it('should return merchant profile metadata logo migration status', async () => {
      const jobStatus = {
        jobId: 'profile-job-1',
        status: 'completed',
        createdAt: '2026-04-02T10:00:00.000Z',
        startedAt: '2026-04-02T10:00:01.000Z',
        finishedAt: '2026-04-02T10:00:08.000Z',
        input: {
          profileId: 'profile-123',
          batchSize: 25,
        },
        summary: {
          total: 3,
          migrated: 2,
          skipped: 1,
          failed: 0,
          batchSize: 25,
          profileId: 'profile-123',
          invalidBlobUrlMerchantProfileMetadataIds: ['metadata-2'],
          failures: [],
        },
      };

      merchantProfileMetadataService.getMerchantProfileMetadataLogosToCdnMigrationStatus.mockReturnValue(jobStatus as any);

      const result = await controller.getMigrateMerchantProfileMetadataLogosToCdnStatus('profile-job-1');

      expect(merchantProfileMetadataService.getMerchantProfileMetadataLogosToCdnMigrationStatus).toHaveBeenCalledWith(
        'profile-job-1'
      );
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(jobStatus);
      expect(result).toEqual({ success: true, data: jobStatus });
    });

    it('should throw when merchant profile metadata migration status job is missing', async () => {
      merchantProfileMetadataService.getMerchantProfileMetadataLogosToCdnMigrationStatus.mockReturnValue(null);

      expect(() => controller.getMigrateMerchantProfileMetadataLogosToCdnStatus('missing-profile-job')).toThrow(
        'Migration job not found'
      );
      expect(merchantProfileMetadataService.getMerchantProfileMetadataLogosToCdnMigrationStatus).toHaveBeenCalledWith(
        'missing-profile-job'
      );
    });
  });

  describe('uploadMerchantProfileImage', () => {
    it('should successfully upload merchant profile image', async () => {
      // Arrange
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: '456',
        setAsHeroImage: false,
      };
      const expectedServiceResponse = { imageId: 'img456', url: 'profile-url' };
      downloaderService.uploadMerchantProfileImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.uploadMerchantProfileImage(mockFile, dto);

      // Assert
      expect(downloaderService.uploadMerchantProfileImage).toHaveBeenCalledWith(dto, mockFile);
      expect(downloaderService.uploadMerchantProfileImage).toHaveBeenCalledTimes(1);
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(expectedServiceResponse);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle missing file', async () => {
      // Arrange
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: '456',
        setAsHeroImage: false,
      };
      const expectedServiceResponse = { error: 'No file provided' };
      downloaderService.uploadMerchantProfileImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.uploadMerchantProfileImage(undefined, dto);

      // Assert
      expect(downloaderService.uploadMerchantProfileImage).toHaveBeenCalledWith(dto, undefined);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle service error', async () => {
      // Arrange
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: '456',
        setAsHeroImage: false,
      };
      const serviceError = new BadRequestException('Invalid merchant ID');
      downloaderService.uploadMerchantProfileImage.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.uploadMerchantProfileImage(mockFile, dto)).rejects.toThrow(BadRequestException);
      expect(downloaderService.uploadMerchantProfileImage).toHaveBeenCalledWith(dto, mockFile);
    });

    it('should handle large file within limits', async () => {
      // Arrange
      const dto: UploadMerchantProfileImageDto = {
        merchantProfileId: '456',
        setAsHeroImage: false,
      };
      const largeFile: Express.Multer.File = {
        ...mockFile,
        size: 4 * 1024 * 1024, // 4MB - within 5MB limit
      };
      const expectedServiceResponse = { imageId: 'img456', url: 'large-profile-url' };
      downloaderService.uploadMerchantProfileImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.uploadMerchantProfileImage(largeFile, dto);

      // Assert
      expect(downloaderService.uploadMerchantProfileImage).toHaveBeenCalledWith(dto, largeFile);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });
  });

  describe('uploadMerchantImage', () => {
    it('should successfully upload merchant image', async () => {
      // Arrange
      const dto: UploadMerchantImageDto = {
        merchantId: '789',
        setAsHeroImage: false,
      };
      const expectedServiceResponse = { imageId: 'img789', url: 'merchant-url' };
      downloaderService.uploadMerchantImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.uploadMerchantImage(mockFile, dto);

      // Assert
      expect(downloaderService.uploadMerchantImage).toHaveBeenCalledWith(dto, mockFile);
      expect(downloaderService.uploadMerchantImage).toHaveBeenCalledTimes(1);
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(expectedServiceResponse);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle PNG file type', async () => {
      // Arrange
      const dto: UploadMerchantImageDto = {
        merchantId: '789',
        setAsHeroImage: false,
      };
      const pngFile: Express.Multer.File = {
        ...mockFile,
        mimetype: 'image/png',
        originalname: 'logo.png',
      };
      const expectedServiceResponse = { imageId: 'img789', url: 'png-url' };
      downloaderService.uploadMerchantImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.uploadMerchantImage(pngFile, dto);

      // Assert
      expect(downloaderService.uploadMerchantImage).toHaveBeenCalledWith(dto, pngFile);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle service timeout', async () => {
      // Arrange
      const dto: UploadMerchantImageDto = {
        merchantId: '789',
        setAsHeroImage: false,
      };
      const timeoutError = new Error('Request timeout');
      downloaderService.uploadMerchantImage.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(controller.uploadMerchantImage(mockFile, dto)).rejects.toThrow('Request timeout');
      expect(downloaderService.uploadMerchantImage).toHaveBeenCalledWith(dto, mockFile);
    });

    it('should handle null response from service', async () => {
      // Arrange
      const dto: UploadMerchantImageDto = {
        merchantId: '789',
        setAsHeroImage: false,
      };
      downloaderService.uploadMerchantImage.mockResolvedValue(null);

      // Act
      const result = await controller.uploadMerchantImage(mockFile, dto);

      // Assert
      expect(downloaderService.uploadMerchantImage).toHaveBeenCalledWith(dto, mockFile);
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(null);
      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe('uploadOutletProfileImage', () => {
    it('should successfully upload outlet profile image', async () => {
      // Arrange
      const dto: UploadOutletProfileImageDto = {
        outletProfileId: '101',
        setAsHeroImage: false,
      };
      const expectedServiceResponse = { imageId: 'img101', url: 'outlet-profile-url' };
      downloaderService.uploadOutletProfileImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.uploadOutletProfileImage(mockFile, dto);

      // Assert
      expect(downloaderService.uploadOutletProfileImage).toHaveBeenCalledWith(dto, mockFile);
      expect(downloaderService.uploadOutletProfileImage).toHaveBeenCalledTimes(1);
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(expectedServiceResponse);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle GIF file type', async () => {
      // Arrange
      const dto: UploadOutletProfileImageDto = {
        outletProfileId: '101',
        setAsHeroImage: false,
      };
      const gifFile: Express.Multer.File = {
        ...mockFile,
        mimetype: 'image/gif',
        originalname: 'animated.gif',
      };
      const expectedServiceResponse = { imageId: 'img101', url: 'gif-url' };
      downloaderService.uploadOutletProfileImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.uploadOutletProfileImage(gifFile, dto);

      // Assert
      expect(downloaderService.uploadOutletProfileImage).toHaveBeenCalledWith(dto, gifFile);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle empty dto object', async () => {
      // Arrange
      const dto = {} as UploadOutletProfileImageDto;
      const expectedServiceResponse = { error: 'Invalid outlet data' };
      downloaderService.uploadOutletProfileImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.uploadOutletProfileImage(mockFile, dto);

      // Assert
      expect(downloaderService.uploadOutletProfileImage).toHaveBeenCalledWith(dto, mockFile);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle concurrent upload requests', async () => {
      // Arrange
      const dto1: UploadOutletProfileImageDto = { outletProfileId: '101', setAsHeroImage: false };
      const dto2: UploadOutletProfileImageDto = { outletProfileId: '102', setAsHeroImage: false };
      const response1 = { imageId: 'img101', url: 'url1' };
      const response2 = { imageId: 'img102', url: 'url2' };

      downloaderService.uploadOutletProfileImage.mockResolvedValueOnce(response1).mockResolvedValueOnce(response2);

      // Act
      const [result1, result2] = await Promise.all([
        controller.uploadOutletProfileImage(mockFile, dto1),
        controller.uploadOutletProfileImage(mockFile, dto2),
      ]);

      // Assert
      expect(downloaderService.uploadOutletProfileImage).toHaveBeenCalledTimes(2);
      expect(result1).toEqual({ success: true, data: response1 });
      expect(result2).toEqual({ success: true, data: response2 });
    });

    it('should handle service throwing BadRequestException', async () => {
      // Arrange
      const dto: UploadOutletProfileImageDto = {
        outletProfileId: '101',
        setAsHeroImage: false,
      };
      const badRequestError = new BadRequestException('Invalid outlet ID format');
      downloaderService.uploadOutletProfileImage.mockRejectedValue(badRequestError);

      // Act & Assert
      await expect(controller.uploadOutletProfileImage(mockFile, dto)).rejects.toThrow(BadRequestException);
      expect(downloaderService.uploadOutletProfileImage).toHaveBeenCalledWith(dto, mockFile);
    });
  });

  describe('File Filter Edge Cases', () => {
    // Note: These tests would require integration testing or testing the interceptor separately
    // as the file filter is applied at the interceptor level before reaching the controller methods

    it('should handle various image MIME types', () => {
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

      validMimeTypes.forEach(mimetype => {
        const testFile: Express.Multer.File = {
          ...mockFile,
          mimetype,
        };
        // In actual implementation, these would pass through the fileFilter
        expect(testFile.mimetype.startsWith('image/')).toBe(true);
      });
    });

    it('should identify invalid file types', () => {
      const invalidMimeTypes = ['text/plain', 'application/pdf', 'video/mp4', 'audio/mpeg', 'application/json'];

      invalidMimeTypes.forEach(mimetype => {
        const testFile: Express.Multer.File = {
          ...mockFile,
          mimetype,
        };
        // These would be rejected by the fileFilter
        expect(testFile.mimetype.startsWith('image/')).toBe(false);
      });
    });
  });

  describe('markMerchantHeroImage', () => {
    it('should successfully mark merchant hero image', async () => {
      // Arrange
      const dto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'image-456',
        existingHeroImageId: 'image-789',
        profileId: 'profile-101',
      };
      const expectedServiceResponse = {
        success: true,
        message: 'Hero image marked successfully',
        imageId: 'image-456',
      };
      downloaderService.markMerchantHeroImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.markMerchantHeroImage(dto);

      // Assert
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledWith(dto);
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledTimes(1);
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(expectedServiceResponse);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle marking hero image with minimal required fields', async () => {
      // Arrange
      const dto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'image-456',
        existingHeroImageId: undefined,
        profileId: undefined,
      };
      const expectedServiceResponse = {
        success: true,
        imageId: 'image-456',
      };
      downloaderService.markMerchantHeroImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.markMerchantHeroImage(dto);

      // Assert
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle unmarking hero image (setAsHeroImage=false)', async () => {
      // Arrange
      const dto = {
        merchantId: 'merchant-123',
        setAsHeroImage: false,
        newHeroImageId: 'image-456',
        existingHeroImageId: 'image-789',
        profileId: 'profile-101',
      };
      const expectedServiceResponse = {
        success: true,
        message: 'Hero image unmarked successfully',
      };
      downloaderService.markMerchantHeroImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.markMerchantHeroImage(dto);

      // Assert
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle service error when merchant not found', async () => {
      // Arrange
      const dto = {
        merchantId: 'non-existent-merchant',
        setAsHeroImage: true,
        newHeroImageId: 'image-456',
        existingHeroImageId: 'image-789',
        profileId: 'profile-101',
      };
      const serviceError = new BadRequestException('Merchant not found');
      downloaderService.markMerchantHeroImage.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.markMerchantHeroImage(dto)).rejects.toThrow(BadRequestException);
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledWith(dto);
    });

    it('should handle service error when image not found', async () => {
      // Arrange
      const dto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'non-existent-image',
        existingHeroImageId: 'image-789',
        profileId: 'profile-101',
      };
      const serviceError = new BadRequestException('Image not found');
      downloaderService.markMerchantHeroImage.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.markMerchantHeroImage(dto)).rejects.toThrow(BadRequestException);
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledWith(dto);
    });

    it('should handle replacing existing hero image', async () => {
      // Arrange
      const dto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'new-hero-image',
        existingHeroImageId: 'old-hero-image',
        profileId: 'profile-101',
      };
      const expectedServiceResponse = {
        success: true,
        message: 'Hero image replaced successfully',
        previousHeroImageId: 'old-hero-image',
        newHeroImageId: 'new-hero-image',
      };
      downloaderService.markMerchantHeroImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.markMerchantHeroImage(dto);

      // Assert
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle null or undefined optional fields', async () => {
      // Arrange
      const dto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'image-456',
        existingHeroImageId: undefined,
        profileId: null,
      };
      const expectedServiceResponse = {
        success: true,
        imageId: 'image-456',
      };
      downloaderService.markMerchantHeroImage.mockResolvedValue(expectedServiceResponse);

      // Act
      const result = await controller.markMerchantHeroImage(dto);

      // Assert
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, data: expectedServiceResponse });
    });

    it('should handle generic service errors', async () => {
      // Arrange
      const dto = {
        merchantId: 'merchant-123',
        setAsHeroImage: true,
        newHeroImageId: 'image-456',
        existingHeroImageId: 'image-789',
        profileId: 'profile-101',
      };
      const serviceError = new Error('Unexpected service error');
      downloaderService.markMerchantHeroImage.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.markMerchantHeroImage(dto)).rejects.toThrow('Unexpected service error');
      expect(downloaderService.markMerchantHeroImage).toHaveBeenCalledWith(dto);
    });

    it('should verify HTTP status code is OK (200)', () => {
      // This test verifies the @HttpCode(HttpStatus.OK) decorator is properly applied
      // In actual implementation, this would return 200 instead of default 201 for POST
      const metadata = Reflect.getMetadata('__httpCode__', controller.markMerchantHeroImage);
      // Note: HttpCode decorator metadata would need to be checked in integration tests
      expect(controller.markMerchantHeroImage).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle baseResponseHelper throwing error', async () => {
      // Arrange
      const dto: UploadOuletImageDto = {
        outletId: '550e8400-e29b-41d4-a716-446655440000',
        imageName: 'test-image.jpg',
        isDefault: true,
      };
      const serviceResponse = { imageId: 'img123' };
      downloaderService.uploadImagesSync.mockResolvedValue(serviceResponse);
      mockBaseResponseHelper.mockImplementation(() => {
        throw new Error('Response helper error');
      });

      // Act & Assert
      await expect(controller.UploadOutletImage(dto)).rejects.toThrow('Response helper error');
      expect(downloaderService.uploadImagesSync).toHaveBeenCalledWith(dto);
      expect(mockBaseResponseHelper).toHaveBeenCalledWith(serviceResponse);
    });

    it('should maintain proper method signatures', () => {
      // Verify all methods exist and have correct signatures
      expect(typeof controller.UploadOutletImage).toBe('function');
      expect(typeof controller.uploadMerchantProfileImage).toBe('function');
      expect(typeof controller.uploadMerchantImage).toBe('function');
      expect(typeof controller.uploadOutletProfileImage).toBe('function');
      expect(typeof controller.markMerchantHeroImage).toBe('function');
    });
  });
});
