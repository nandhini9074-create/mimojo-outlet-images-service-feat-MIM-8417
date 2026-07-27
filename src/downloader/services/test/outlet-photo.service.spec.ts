import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { OutletPhoto } from 'src/downloader/models/outlet-photo.model';
import { OutletPhotoService } from '../outlet-photo.service';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Op } from 'sequelize';

describe('OutletPhotoService', () => {
  let service: OutletPhotoService;
  let outletPhotoModel: jest.Mocked<typeof OutletPhoto>;
  let mockLogger: jest.Mocked<CustomPinoLogger>;

  const mockOutletPhotoModel = {
    create: jest.fn(),
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutletPhotoService,
        {
          provide: getModelToken(OutletPhoto),
          useValue: mockOutletPhotoModel,
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

    service = module.get<OutletPhotoService>(OutletPhotoService);
    outletPhotoModel = module.get(getModelToken(OutletPhoto));
    mockLogger = module.get(CustomPinoLogger);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('insert', () => {
    const validOutletId = 'outlet-123';
    const validCdnUrl = 'https://cdn.example.com/photo.jpg';
    const validIsDefault = true;

    const expectedCreatePayload = {
      outletId: validOutletId,
      cdnUrl: validCdnUrl,
      isDefault: validIsDefault,
      isActive: true,
    };

    const mockCreatedPhoto = {
      id: 1,
      outletId: validOutletId,
      cdnUrl: validCdnUrl,
      isDefault: validIsDefault,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('Success scenarios', () => {
      it('should successfully create outlet photo with default true', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        const result = await service.insert(validOutletId, validCdnUrl, true);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledTimes(1);
        expect(outletPhotoModel.create).toHaveBeenCalledWith({
          outletId: validOutletId,
          cdnUrl: validCdnUrl,
          isDefault: true,
          isActive: true,
        });
        expect(result).toEqual(mockCreatedPhoto);
      });

      it('should successfully create outlet photo with default false', async () => {
        // Arrange
        const mockNonDefaultPhoto = { ...mockCreatedPhoto, isDefault: false };
        outletPhotoModel.create.mockResolvedValue(mockNonDefaultPhoto as any);

        // Act
        const result = await service.insert(validOutletId, validCdnUrl, false);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledTimes(1);
        expect(outletPhotoModel.create).toHaveBeenCalledWith({
          outletId: validOutletId,
          cdnUrl: validCdnUrl,
          isDefault: false,
          isActive: true,
        });
        expect(result).toEqual(mockNonDefaultPhoto);
      });

      it('should always set isActive to true regardless of input', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        await service.insert(validOutletId, validCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: true,
          })
        );
      });
    });

    describe('Parameter validation scenarios', () => {
      it('should handle empty string outlet_id', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        const result = await service.insert('', validCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith({
          outletId: '',
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        });
        expect(result).toEqual(mockCreatedPhoto);
      });

      it('should handle empty string cdn_url', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        const result = await service.insert(validOutletId, '', validIsDefault);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith({
          outletId: validOutletId,
          cdnUrl: '',
          isDefault: validIsDefault,
          isActive: true,
        });
        expect(result).toEqual(mockCreatedPhoto);
      });

      it('should handle null values gracefully', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        const result = await service.insert(null as any, null as any, null as any);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith({
          outletId: null,
          cdnUrl: null,
          isDefault: null,
          isActive: true,
        });
        expect(result).toEqual(mockCreatedPhoto);
      });

      it('should handle undefined values gracefully', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        const result = await service.insert(undefined as any, undefined as any, undefined as any);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith({
          outletId: undefined,
          cdnUrl: undefined,
          isDefault: undefined,
          isActive: true,
        });
        expect(result).toEqual(mockCreatedPhoto);
      });
    });

    describe('Error handling scenarios', () => {
      it('should throw error when database create fails', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        outletPhotoModel.create.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.insert(validOutletId, validCdnUrl, validIsDefault)).rejects.toThrow(
          'Database connection failed'
        );

        expect(outletPhotoModel.create).toHaveBeenCalledTimes(1);
        expect(outletPhotoModel.create).toHaveBeenCalledWith(expectedCreatePayload);
      });

      it('should throw validation error from Sequelize', async () => {
        // Arrange
        const validationError = new Error('Validation error: outletId cannot be null');
        validationError.name = 'SequelizeValidationError';
        outletPhotoModel.create.mockRejectedValue(validationError);

        // Act & Assert
        await expect(service.insert(validOutletId, validCdnUrl, validIsDefault)).rejects.toThrow(
          'Validation error: outletId cannot be null'
        );

        expect(outletPhotoModel.create).toHaveBeenCalledTimes(1);
      });

      it('should throw unique constraint error', async () => {
        // Arrange
        const uniqueError = new Error('Unique constraint error');
        uniqueError.name = 'SequelizeUniqueConstraintError';
        outletPhotoModel.create.mockRejectedValue(uniqueError);

        // Act & Assert
        await expect(service.insert(validOutletId, validCdnUrl, validIsDefault)).rejects.toThrow('Unique constraint error');

        expect(outletPhotoModel.create).toHaveBeenCalledTimes(1);
      });

      it('should throw foreign key constraint error', async () => {
        // Arrange
        const fkError = new Error('Foreign key constraint error');
        fkError.name = 'SequelizeForeignKeyConstraintError';
        outletPhotoModel.create.mockRejectedValue(fkError);

        // Act & Assert
        await expect(service.insert(validOutletId, validCdnUrl, validIsDefault)).rejects.toThrow(
          'Foreign key constraint error'
        );

        expect(outletPhotoModel.create).toHaveBeenCalledTimes(1);
      });
    });

    describe('Data type scenarios', () => {
      it('should handle boolean true for is_default', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        await service.insert(validOutletId, validCdnUrl, true);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isDefault: true,
          })
        );
      });

      it('should handle boolean false for is_default', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        await service.insert(validOutletId, validCdnUrl, false);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isDefault: false,
          })
        );
      });

      it('should handle truthy values for is_default', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        await service.insert(validOutletId, validCdnUrl, 'true' as any);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isDefault: 'true',
          })
        );
      });

      it('should handle falsy values for is_default', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        await service.insert(validOutletId, validCdnUrl, 0 as any);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            isDefault: 0,
          })
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle very long outlet_id', async () => {
        // Arrange
        const longOutletId = 'a'.repeat(1000);
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        await service.insert(longOutletId, validCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            outletId: longOutletId,
          })
        );
      });

      it('should handle very long cdn_url', async () => {
        // Arrange
        const longCdnUrl = 'https://example.com/' + 'a'.repeat(1000) + '.jpg';
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        await service.insert(validOutletId, longCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            cdnUrl: longCdnUrl,
          })
        );
      });

      it('should handle special characters in parameters', async () => {
        // Arrange
        const specialOutletId = 'outlet-123!@#$%^&*()';
        const specialCdnUrl = 'https://cdn.example.com/photo with spaces & special chars!.jpg';
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        await service.insert(specialOutletId, specialCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.create).toHaveBeenCalledWith({
          outletId: specialOutletId,
          cdnUrl: specialCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        });
      });
    });

    describe('Return value scenarios', () => {
      it('should return the created model instance', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(mockCreatedPhoto as any);

        // Act
        const result = await service.insert(validOutletId, validCdnUrl, validIsDefault);

        // Assert
        expect(result).toBe(mockCreatedPhoto);
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('outletId', validOutletId);
        expect(result).toHaveProperty('cdnUrl', validCdnUrl);
        expect(result).toHaveProperty('isDefault', validIsDefault);
        expect(result).toHaveProperty('isActive', true);
      });

      it('should return null if model.create returns null', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(null as any);

        // Act
        const result = await service.insert(validOutletId, validCdnUrl, validIsDefault);

        // Assert
        expect(result).toBeNull();
      });

      it('should return undefined if model.create returns undefined', async () => {
        // Arrange
        outletPhotoModel.create.mockResolvedValue(undefined as any);

        // Act
        const result = await service.insert(validOutletId, validCdnUrl, validIsDefault);

        // Assert
        expect(result).toBeUndefined();
      });
    });
  });

  describe('bulkDelete', () => {
    const validOutletIds = ['outlet-1', 'outlet-2', 'outlet-3'];

    describe('Success scenarios', () => {
      it('should successfully delete outlet photos for multiple outlets', async () => {
        // Arrange
        const deletedCount = 3;
        outletPhotoModel.destroy.mockResolvedValue(deletedCount as any);

        // Act
        const result = await service.bulkDelete(validOutletIds);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('OutletPhotoService.bulkDelete called', { outletIds: validOutletIds });
        expect(outletPhotoModel.destroy).toHaveBeenCalledTimes(1);
        expect(outletPhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletId: { [Op.in]: validOutletIds },
            isDefault: true,
            isActive: true,
          },
        });
        expect(result).toBe(deletedCount);
      });

      it('should successfully delete with single outlet ID', async () => {
        // Arrange
        const singleOutletId = ['outlet-1'];
        const deletedCount = 1;
        outletPhotoModel.destroy.mockResolvedValue(deletedCount as any);

        // Act
        const result = await service.bulkDelete(singleOutletId);

        // Assert
        expect(outletPhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletId: { [Op.in]: singleOutletId },
            isDefault: true,
            isActive: true,
          },
        });
        expect(result).toBe(1);
      });

      it('should return 0 when no records are deleted', async () => {
        // Arrange
        outletPhotoModel.destroy.mockResolvedValue(0 as any);

        // Act
        const result = await service.bulkDelete(validOutletIds);

        // Assert
        expect(outletPhotoModel.destroy).toHaveBeenCalledTimes(1);
        expect(result).toBe(0);
      });

      it('should only delete photos with isDefault=true and isActive=true', async () => {
        // Arrange
        outletPhotoModel.destroy.mockResolvedValue(2 as any);

        // Act
        await service.bulkDelete(validOutletIds);

        // Assert
        expect(outletPhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletId: { [Op.in]: validOutletIds },
            isDefault: true,
            isActive: true,
          },
        });
      });
    });

    describe('Empty or invalid input scenarios', () => {
      it('should return 0 when outletIds array is empty', async () => {
        // Arrange
        const emptyArray: string[] = [];

        // Act
        const result = await service.bulkDelete(emptyArray);

        // Assert
        expect(mockLogger.warn).toHaveBeenCalledWith('bulkDelete called with empty outletIds');
        expect(outletPhotoModel.destroy).not.toHaveBeenCalled();
        expect(result).toBe(0);
      });

      it('should return 0 when outletIds is null', async () => {
        // Act
        const result = await service.bulkDelete(null as any);

        // Assert
        expect(mockLogger.warn).toHaveBeenCalledWith('bulkDelete called with empty outletIds');
        expect(outletPhotoModel.destroy).not.toHaveBeenCalled();
        expect(result).toBe(0);
      });

      it('should return 0 when outletIds is undefined', async () => {
        // Act
        const result = await service.bulkDelete(undefined as any);

        // Assert
        expect(mockLogger.warn).toHaveBeenCalledWith('bulkDelete called with empty outletIds');
        expect(outletPhotoModel.destroy).not.toHaveBeenCalled();
        expect(result).toBe(0);
      });
    });

    describe('Error handling scenarios', () => {
      it('should throw HttpException when database error occurs', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        outletPhotoModel.destroy.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.bulkDelete(validOutletIds)).rejects.toThrow(
          new HttpException('Failed to delete the default image', HttpStatus.INTERNAL_SERVER_ERROR)
        );
        expect(mockLogger.error).toHaveBeenCalledWith('OutletPhotoService.bulkDelete error', { error: dbError });
      });

      it('should log error and throw HttpException on unexpected error', async () => {
        // Arrange
        const unexpectedError = new Error('Unexpected error');
        outletPhotoModel.destroy.mockRejectedValue(unexpectedError);

        // Act & Assert
        await expect(service.bulkDelete(validOutletIds)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('OutletPhotoService.bulkDelete error', { error: unexpectedError });
      });
    });

    describe('Edge cases', () => {
      it('should handle very large array of outlet IDs', async () => {
        // Arrange
        const largeOutletIds = Array.from({ length: 1000 }, (_, i) => `outlet-${i}`);
        outletPhotoModel.destroy.mockResolvedValue(500 as any);

        // Act
        const result = await service.bulkDelete(largeOutletIds);

        // Assert
        expect(outletPhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletId: { [Op.in]: largeOutletIds },
            isDefault: true,
            isActive: true,
          },
        });
        expect(result).toBe(500);
      });

      it('should handle outlet IDs with special characters', async () => {
        // Arrange
        const specialIds = ['outlet-1!@#', 'outlet-2$%^', 'outlet-3&*()'];
        outletPhotoModel.destroy.mockResolvedValue(3 as any);

        // Act
        const result = await service.bulkDelete(specialIds);

        // Assert
        expect(outletPhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletId: { [Op.in]: specialIds },
            isDefault: true,
            isActive: true,
          },
        });
        expect(result).toBe(3);
      });
    });
  });

  describe('bulkInsert', () => {
    const validOutletIds = ['outlet-1', 'outlet-2', 'outlet-3'];
    const validCdnUrl = 'https://cdn.example.com/hero-image.jpg';
    const validIsDefault = true;

    describe('Success scenarios', () => {
      it('should successfully bulk insert outlet photos for multiple outlets', async () => {
        // Arrange
        const expectedRecords = validOutletIds.map(outletId => ({
          outletId,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        const mockCreatedRecords = expectedRecords.map((record, index) => ({ ...record, id: index + 1 }));
        outletPhotoModel.bulkCreate.mockResolvedValue(mockCreatedRecords as any);

        // Act
        const result = await service.bulkInsert(validOutletIds, validCdnUrl, validIsDefault);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('OutletPhotoService.bulkInsert called', { outletIds: validOutletIds });
        expect(outletPhotoModel.bulkCreate).toHaveBeenCalledTimes(1);
        expect(outletPhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(mockCreatedRecords);
      });

      it('should successfully bulk insert with single outlet ID', async () => {
        // Arrange
        const singleOutletId = ['outlet-1'];
        const expectedRecords = [
          {
            outletId: 'outlet-1',
            cdnUrl: validCdnUrl,
            isDefault: validIsDefault,
            isActive: true,
          },
        ];
        outletPhotoModel.bulkCreate.mockResolvedValue(expectedRecords as any);

        // Act
        const result = await service.bulkInsert(singleOutletId, validCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });

      it('should set isDefault to false when provided', async () => {
        // Arrange
        const expectedRecords = validOutletIds.map(outletId => ({
          outletId,
          cdnUrl: validCdnUrl,
          isDefault: false,
          isActive: true,
        }));
        outletPhotoModel.bulkCreate.mockResolvedValue(expectedRecords as any);

        // Act
        await service.bulkInsert(validOutletIds, validCdnUrl, false);

        // Assert
        expect(outletPhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
      });

      it('should always set isActive to true', async () => {
        // Arrange
        const expectedRecords = validOutletIds.map(outletId => ({
          outletId,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        outletPhotoModel.bulkCreate.mockResolvedValue(expectedRecords as any);

        // Act
        await service.bulkInsert(validOutletIds, validCdnUrl, validIsDefault);

        // Assert
        const callArg = outletPhotoModel.bulkCreate.mock.calls[0][0];
        callArg.forEach((record: any) => {
          expect(record.isActive).toBe(true);
        });
      });
    });

    describe('Empty or invalid input scenarios', () => {
      it('should return empty array when outletIds array is empty', async () => {
        // Arrange
        const emptyArray: string[] = [];

        // Act
        const result = await service.bulkInsert(emptyArray, validCdnUrl, validIsDefault);

        // Assert
        expect(mockLogger.warn).toHaveBeenCalledWith('bulkInsert called with empty outletIds');
        expect(outletPhotoModel.bulkCreate).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it('should return empty array when outletIds is null', async () => {
        // Act
        const result = await service.bulkInsert(null as any, validCdnUrl, validIsDefault);

        // Assert
        expect(mockLogger.warn).toHaveBeenCalledWith('bulkInsert called with empty outletIds');
        expect(outletPhotoModel.bulkCreate).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it('should return empty array when outletIds is undefined', async () => {
        // Act
        const result = await service.bulkInsert(undefined as any, validCdnUrl, validIsDefault);

        // Assert
        expect(mockLogger.warn).toHaveBeenCalledWith('bulkInsert called with empty outletIds');
        expect(outletPhotoModel.bulkCreate).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });
    });

    describe('Error handling scenarios', () => {
      it('should throw HttpException when database error occurs', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        outletPhotoModel.bulkCreate.mockRejectedValue(dbError);

        // Act & Assert
        try {
          await service.bulkInsert(validOutletIds, validCdnUrl, validIsDefault);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Failed to insert the default image');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('OutletPhotoService.bulkInsert error', { error: dbError });
      });

      it('should log error and throw HttpException on validation error', async () => {
        // Arrange
        const validationError = new Error('Validation error: Invalid CDN URL');
        outletPhotoModel.bulkCreate.mockRejectedValue(validationError);

        // Act & Assert
        try {
          await service.bulkInsert(validOutletIds, validCdnUrl, validIsDefault);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Failed to insert the default image');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('OutletPhotoService.bulkInsert error', { error: validationError });
      });

      it('should throw HttpException on constraint violation', async () => {
        // Arrange
        const constraintError = new Error('Unique constraint violation');
        outletPhotoModel.bulkCreate.mockRejectedValue(constraintError);

        // Act & Assert
        try {
          await service.bulkInsert(validOutletIds, validCdnUrl, validIsDefault);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Failed to insert the default image');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('OutletPhotoService.bulkInsert error', { error: constraintError });
      });
    });

    describe('Edge cases', () => {
      it('should handle very large array of outlet IDs', async () => {
        // Arrange
        const largeOutletIds = Array.from({ length: 1000 }, (_, i) => `outlet-${i}`);
        const expectedRecords = largeOutletIds.map(outletId => ({
          outletId,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        outletPhotoModel.bulkCreate.mockResolvedValue(expectedRecords as any);

        // Act
        const result = await service.bulkInsert(largeOutletIds, validCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toHaveLength(1000);
      });

      it('should handle outlet IDs with special characters', async () => {
        // Arrange
        const specialIds = ['outlet-1!@#', 'outlet-2$%^', 'outlet-3&*()'];
        const expectedRecords = specialIds.map(outletId => ({
          outletId,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        outletPhotoModel.bulkCreate.mockResolvedValue(expectedRecords as any);

        // Act
        const result = await service.bulkInsert(specialIds, validCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });

      it('should handle empty string CDN URL', async () => {
        // Arrange
        const expectedRecords = validOutletIds.map(outletId => ({
          outletId,
          cdnUrl: '',
          isDefault: validIsDefault,
          isActive: true,
        }));
        outletPhotoModel.bulkCreate.mockResolvedValue(expectedRecords as any);

        // Act
        const result = await service.bulkInsert(validOutletIds, '', validIsDefault);

        // Assert
        expect(outletPhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });

      it('should handle very long CDN URL', async () => {
        // Arrange
        const longCdnUrl = 'https://cdn.example.com/' + 'a'.repeat(1000) + '.jpg';
        const expectedRecords = validOutletIds.map(outletId => ({
          outletId,
          cdnUrl: longCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        outletPhotoModel.bulkCreate.mockResolvedValue(expectedRecords as any);

        // Act
        const result = await service.bulkInsert(validOutletIds, longCdnUrl, validIsDefault);

        // Assert
        expect(outletPhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });
    });

    describe('Return value scenarios', () => {
      it('should return array of created records', async () => {
        // Arrange
        const expectedRecords = validOutletIds.map((outletId, index) => ({
          id: index + 1,
          outletId,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        outletPhotoModel.bulkCreate.mockResolvedValue(expectedRecords as any);

        // Act
        const result = await service.bulkInsert(validOutletIds, validCdnUrl, validIsDefault);

        // Assert
        expect(result).toEqual(expectedRecords);
        expect(result).toHaveLength(validOutletIds.length);
        result.forEach((record: any, index: number) => {
          expect(record).toHaveProperty('id');
          expect(record).toHaveProperty('outletId', validOutletIds[index]);
          expect(record).toHaveProperty('cdnUrl', validCdnUrl);
          expect(record).toHaveProperty('isDefault', validIsDefault);
          expect(record).toHaveProperty('isActive', true);
        });
      });
    });
  });

  describe('Service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have outletPhotoModel injected', () => {
      expect(outletPhotoModel).toBeDefined();
    });

    it('should have logger injected', () => {
      expect(mockLogger).toBeDefined();
    });
  });
});
