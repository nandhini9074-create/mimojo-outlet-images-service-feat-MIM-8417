import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { HttpException, HttpStatus } from '@nestjs/common';
import { OutletProfileMetadataService } from '../outlet-profile-metadata.service';
import { OutletProfileMetadata } from 'src/downloader/models/outlet-profile.model';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

describe('OutletProfileMetadataService', () => {
  let service: OutletProfileMetadataService;
  let outletProfileMetadataModel: jest.Mocked<typeof OutletProfileMetadata>;
  let mockLogger: jest.Mocked<CustomPinoLogger>;

  const mockOutletProfileMetadataModel = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutletProfileMetadataService,
        {
          provide: getModelToken(OutletProfileMetadata),
          useValue: mockOutletProfileMetadataModel,
        },
        {
          provide: CustomPinoLogger,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OutletProfileMetadataService>(OutletProfileMetadataService);
    outletProfileMetadataModel = module.get(getModelToken(OutletProfileMetadata));
    mockLogger = module.get(CustomPinoLogger);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getOutletIdMerchantId', () => {
    const validMerchantId = 'merchant-123';

    describe('Success scenarios', () => {
      it('should successfully return outlet IDs for a merchant', async () => {
        // Arrange
        const mockOutlets = [{ outletId: 'outlet-1' }, { outletId: 'outlet-2' }, { outletId: 'outlet-3' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('OutletProfileMetadataService.getOutletIdMerchantId called', {
          merchantId: validMerchantId,
        });
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledTimes(1);
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledWith({
          attributes: ['outletId'],
          where: { merchantId: validMerchantId },
        });
        expect(result).toEqual(['outlet-1', 'outlet-2', 'outlet-3']);
      });

      it('should return single outlet ID', async () => {
        // Arrange
        const mockOutlets = [{ outletId: 'outlet-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(result).toEqual(['outlet-1']);
      });

      it('should remove duplicate outlet IDs', async () => {
        // Arrange
        const mockOutlets = [
          { outletId: 'outlet-1' },
          { outletId: 'outlet-2' },
          { outletId: 'outlet-1' },
          { outletId: 'outlet-3' },
          { outletId: 'outlet-2' },
        ];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(result).toEqual(['outlet-1', 'outlet-2', 'outlet-3']);
        expect(result).toHaveLength(3);
      });

      it('should return empty array when no outlets found', async () => {
        // Arrange
        outletProfileMetadataModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });

      it('should preserve order of unique outlet IDs', async () => {
        // Arrange
        const mockOutlets = [{ outletId: 'outlet-3' }, { outletId: 'outlet-1' }, { outletId: 'outlet-2' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(result).toEqual(['outlet-3', 'outlet-1', 'outlet-2']);
      });
    });

    describe('Error handling scenarios', () => {
      it('should throw HttpException when database query fails', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        outletProfileMetadataModel.findAll.mockRejectedValue(dbError);

        // Act & Assert
        try {
          await service.getOutletIdMerchantId(validMerchantId);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('OutletProfileMetadataService.getOutletIdMerchantId failed');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('OutletProfileMetadataService.getOutletIdMerchantId failed', dbError);
      });

      it('should throw HttpException when findAll throws unexpected error', async () => {
        // Arrange
        const unexpectedError = new Error('Unexpected error');
        outletProfileMetadataModel.findAll.mockRejectedValue(unexpectedError);

        // Act & Assert
        await expect(service.getOutletIdMerchantId(validMerchantId)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'OutletProfileMetadataService.getOutletIdMerchantId failed',
          unexpectedError
        );
      });

      it('should throw HttpException with INTERNAL_SERVER_ERROR status', async () => {
        // Arrange
        const error = new Error('Database error');
        outletProfileMetadataModel.findAll.mockRejectedValue(error);

        // Act & Assert
        try {
          await service.getOutletIdMerchantId(validMerchantId);
        } catch (err) {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string merchant ID', async () => {
        // Arrange
        outletProfileMetadataModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getOutletIdMerchantId('');

        // Assert
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledWith({
          attributes: ['outletId'],
          where: { merchantId: '' },
        });
        expect(result).toEqual([]);
      });

      it('should handle very long merchant ID', async () => {
        // Arrange
        const longMerchantId = 'merchant-' + 'a'.repeat(1000);
        const mockOutlets = [{ outletId: 'outlet-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(longMerchantId);

        // Assert
        expect(result).toEqual(['outlet-1']);
      });

      it('should handle special characters in merchant ID', async () => {
        // Arrange
        const specialMerchantId = 'merchant-!@#$%^&*()';
        const mockOutlets = [{ outletId: 'outlet-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(specialMerchantId);

        // Assert
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledWith({
          attributes: ['outletId'],
          where: { merchantId: specialMerchantId },
        });
        expect(result).toEqual(['outlet-1']);
      });

      it('should handle large number of outlet IDs', async () => {
        // Arrange
        const mockOutlets = Array.from({ length: 1000 }, (_, i) => ({ outletId: `outlet-${i}` }));
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(result).toHaveLength(1000);
        expect(result[0]).toBe('outlet-0');
        expect(result[999]).toBe('outlet-999');
      });

      it('should handle outlet IDs with special characters', async () => {
        // Arrange
        const mockOutlets = [{ outletId: 'outlet-1!@#' }, { outletId: 'outlet-2$%^' }, { outletId: 'outlet-3&*()' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(result).toEqual(['outlet-1!@#', 'outlet-2$%^', 'outlet-3&*()']);
      });
    });

    describe('Deduplication scenarios', () => {
      it('should handle all duplicate outlet IDs', async () => {
        // Arrange
        const mockOutlets = [{ outletId: 'outlet-1' }, { outletId: 'outlet-1' }, { outletId: 'outlet-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(result).toEqual(['outlet-1']);
        expect(result).toHaveLength(1);
      });

      it('should handle mixed duplicates', async () => {
        // Arrange
        const mockOutlets = [
          { outletId: 'outlet-1' },
          { outletId: 'outlet-2' },
          { outletId: 'outlet-1' },
          { outletId: 'outlet-3' },
          { outletId: 'outlet-2' },
          { outletId: 'outlet-3' },
          { outletId: 'outlet-1' },
        ];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutlets as any);

        // Act
        const result = await service.getOutletIdMerchantId(validMerchantId);

        // Assert
        expect(result).toEqual(['outlet-1', 'outlet-2', 'outlet-3']);
        expect(result).toHaveLength(3);
      });
    });
  });

  describe('getOutletProfileIdMerchantId', () => {
    const validMerchantId = 'merchant-123';
    const validProfileId = 'profile-456';

    describe('Success scenarios', () => {
      it('should successfully return outlet profile IDs for merchant and profile', async () => {
        // Arrange
        const mockOutletProfiles = [{ id: 'outlet-profile-1' }, { id: 'outlet-profile-2' }, { id: 'outlet-profile-3' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('OutletProfileMetadataService.getOutletProfileIdMerchantId called', {
          merchantId: validMerchantId,
          profileId: validProfileId,
        });
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledTimes(1);
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledWith({
          attributes: ['id'],
          where: { merchantId: validMerchantId, profileId: validProfileId },
        });
        expect(result).toEqual(['outlet-profile-1', 'outlet-profile-2', 'outlet-profile-3']);
      });

      it('should return single outlet profile ID', async () => {
        // Arrange
        const mockOutletProfiles = [{ id: 'outlet-profile-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(result).toEqual(['outlet-profile-1']);
      });

      it('should remove duplicate outlet profile IDs', async () => {
        // Arrange
        const mockOutletProfiles = [
          { id: 'outlet-profile-1' },
          { id: 'outlet-profile-2' },
          { id: 'outlet-profile-1' },
          { id: 'outlet-profile-3' },
          { id: 'outlet-profile-2' },
        ];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(result).toEqual(['outlet-profile-1', 'outlet-profile-2', 'outlet-profile-3']);
        expect(result).toHaveLength(3);
      });

      it('should return empty array when no outlet profiles found', async () => {
        // Arrange
        outletProfileMetadataModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });

      it('should preserve order of unique outlet profile IDs', async () => {
        // Arrange
        const mockOutletProfiles = [{ id: 'outlet-profile-3' }, { id: 'outlet-profile-1' }, { id: 'outlet-profile-2' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(result).toEqual(['outlet-profile-3', 'outlet-profile-1', 'outlet-profile-2']);
      });
    });

    describe('Error handling scenarios', () => {
      it('should throw HttpException when database query fails', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        outletProfileMetadataModel.findAll.mockRejectedValue(dbError);

        // Act & Assert
        try {
          await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('OutletProfileMetadataService.getOutletProfileIdMerchantId failed');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          'OutletProfileMetadataService.getOutletProfileIdMerchantId failed',
          dbError
        );
      });

      it('should throw HttpException when findAll throws unexpected error', async () => {
        // Arrange
        const unexpectedError = new Error('Unexpected error');
        outletProfileMetadataModel.findAll.mockRejectedValue(unexpectedError);

        // Act & Assert
        await expect(service.getOutletProfileIdMerchantId(validMerchantId, validProfileId)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'OutletProfileMetadataService.getOutletProfileIdMerchantId failed',
          unexpectedError
        );
      });

      it('should throw HttpException with INTERNAL_SERVER_ERROR status', async () => {
        // Arrange
        const error = new Error('Database error');
        outletProfileMetadataModel.findAll.mockRejectedValue(error);

        // Act & Assert
        try {
          await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);
        } catch (err) {
          expect(err).toBeInstanceOf(HttpException);
          expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string merchant ID', async () => {
        // Arrange
        outletProfileMetadataModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getOutletProfileIdMerchantId('', validProfileId);

        // Assert
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledWith({
          attributes: ['id'],
          where: { merchantId: '', profileId: validProfileId },
        });
        expect(result).toEqual([]);
      });

      it('should handle empty string profile ID', async () => {
        // Arrange
        outletProfileMetadataModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, '');

        // Assert
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledWith({
          attributes: ['id'],
          where: { merchantId: validMerchantId, profileId: '' },
        });
        expect(result).toEqual([]);
      });

      it('should handle both empty strings', async () => {
        // Arrange
        outletProfileMetadataModel.findAll.mockResolvedValue([]);

        // Act
        const result = await service.getOutletProfileIdMerchantId('', '');

        // Assert
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledWith({
          attributes: ['id'],
          where: { merchantId: '', profileId: '' },
        });
        expect(result).toEqual([]);
      });

      it('should handle very long merchant ID and profile ID', async () => {
        // Arrange
        const longMerchantId = 'merchant-' + 'a'.repeat(1000);
        const longProfileId = 'profile-' + 'b'.repeat(1000);
        const mockOutletProfiles = [{ id: 'outlet-profile-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(longMerchantId, longProfileId);

        // Assert
        expect(result).toEqual(['outlet-profile-1']);
      });

      it('should handle special characters in both IDs', async () => {
        // Arrange
        const specialMerchantId = 'merchant-!@#$%^&*()';
        const specialProfileId = 'profile-!@#$%^&*()';
        const mockOutletProfiles = [{ id: 'outlet-profile-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(specialMerchantId, specialProfileId);

        // Assert
        expect(outletProfileMetadataModel.findAll).toHaveBeenCalledWith({
          attributes: ['id'],
          where: { merchantId: specialMerchantId, profileId: specialProfileId },
        });
        expect(result).toEqual(['outlet-profile-1']);
      });

      it('should handle large number of outlet profile IDs', async () => {
        // Arrange
        const mockOutletProfiles = Array.from({ length: 1000 }, (_, i) => ({ id: `outlet-profile-${i}` }));
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(result).toHaveLength(1000);
        expect(result[0]).toBe('outlet-profile-0');
        expect(result[999]).toBe('outlet-profile-999');
      });

      it('should handle outlet profile IDs with special characters', async () => {
        // Arrange
        const mockOutletProfiles = [
          { id: 'outlet-profile-1!@#' },
          { id: 'outlet-profile-2$%^' },
          { id: 'outlet-profile-3&*()' },
        ];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(result).toEqual(['outlet-profile-1!@#', 'outlet-profile-2$%^', 'outlet-profile-3&*()']);
      });
    });

    describe('Deduplication scenarios', () => {
      it('should handle all duplicate outlet profile IDs', async () => {
        // Arrange
        const mockOutletProfiles = [{ id: 'outlet-profile-1' }, { id: 'outlet-profile-1' }, { id: 'outlet-profile-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(result).toEqual(['outlet-profile-1']);
        expect(result).toHaveLength(1);
      });

      it('should handle mixed duplicates', async () => {
        // Arrange
        const mockOutletProfiles = [
          { id: 'outlet-profile-1' },
          { id: 'outlet-profile-2' },
          { id: 'outlet-profile-1' },
          { id: 'outlet-profile-3' },
          { id: 'outlet-profile-2' },
          { id: 'outlet-profile-3' },
          { id: 'outlet-profile-1' },
        ];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        const result = await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        expect(result).toEqual(['outlet-profile-1', 'outlet-profile-2', 'outlet-profile-3']);
        expect(result).toHaveLength(3);
      });
    });

    describe('Complex where clause scenarios', () => {
      it('should use both merchantId and profileId in where clause', async () => {
        // Arrange
        const mockOutletProfiles = [{ id: 'outlet-profile-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        const callArgs = outletProfileMetadataModel.findAll.mock.calls[0][0];
        expect(callArgs.where).toHaveProperty('merchantId', validMerchantId);
        expect(callArgs.where).toHaveProperty('profileId', validProfileId);
      });

      it('should only select id attribute', async () => {
        // Arrange
        const mockOutletProfiles = [{ id: 'outlet-profile-1' }];
        outletProfileMetadataModel.findAll.mockResolvedValue(mockOutletProfiles as any);

        // Act
        await service.getOutletProfileIdMerchantId(validMerchantId, validProfileId);

        // Assert
        const callArgs = outletProfileMetadataModel.findAll.mock.calls[0][0];
        expect(callArgs.attributes).toEqual(['id']);
      });
    });
  });

  describe('Service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have outletProfileMetadataModel injected', () => {
      expect(outletProfileMetadataModel).toBeDefined();
    });

    it('should have logger injected', () => {
      expect(mockLogger).toBeDefined();
    });
  });
});
