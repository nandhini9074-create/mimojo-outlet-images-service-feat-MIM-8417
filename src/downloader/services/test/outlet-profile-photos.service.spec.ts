import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { OutletProfilePhotos } from 'src/downloader/models/outlet-profile-photos';
import { OutletProfilePhotoService } from '../outlet-profile-photos.service';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { Op } from 'sequelize';

describe('OutletProfilePhotoService', () => {
  let service: OutletProfilePhotoService;
  let mockOutletProfilePhotoModel: any;
  let mockLogger: any;

  const mockOutletProfilePhoto = {
    id: '123',
    outletProfileMetadataId: 'outlet-123',
    cdnUrl: 'https://cdn.example.com/image.jpg',
    isActive: true,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Create mock for the Sequelize model
    mockOutletProfilePhotoModel = {
      create: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
    };

    // Create mock for CustomPinoLogger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutletProfilePhotoService,
        {
          provide: getModelToken(OutletProfilePhotos),
          useValue: mockOutletProfilePhotoModel,
        },
        {
          provide: CustomPinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<OutletProfilePhotoService>(OutletProfilePhotoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('insert', () => {
    const outletProfileId = 'outlet-123';
    const cdnUrl = 'https://cdn.example.com/image.jpg';
    const isDefault = true;
    const mockCreatedData = {
      id: 'photo-1',
      outletProfileMetadataId: outletProfileId,
      cdnUrl: cdnUrl,
      isActive: true,
      isDefault: isDefault,
      get: jest.fn().mockReturnValue({
        id: 'photo-1',
        outletProfileMetadataId: outletProfileId,
        cdnUrl: cdnUrl,
        isActive: true,
        isDefault: isDefault,
      }),
    };

    it('should successfully insert outlet profile photo with isDefault true', async () => {
      mockOutletProfilePhotoModel.create.mockResolvedValue(mockCreatedData);

      const result = await service.insert(outletProfileId, cdnUrl, isDefault);

      expect(mockOutletProfilePhotoModel.create).toHaveBeenCalledWith({
        outletProfileMetadataId: outletProfileId,
        cdnUrl: cdnUrl,
        isActive: true,
        isDefault: true,
      });
      expect(result).toEqual({
        id: 'photo-1',
        outletProfileMetadataId: outletProfileId,
        cdnUrl: cdnUrl,
        isActive: true,
        isDefault: true,
        outletPhotoId: 'photo-1',
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should successfully insert outlet profile photo with isDefault false', async () => {
      const mockCreatedDataFalse = {
        ...mockCreatedData,
        isDefault: false,
        get: jest.fn().mockReturnValue({
          ...mockCreatedData.get(),
          isDefault: false,
        }),
      };

      mockOutletProfilePhotoModel.create.mockResolvedValue(mockCreatedDataFalse);

      const result = await service.insert(outletProfileId, cdnUrl, false);

      expect(result).toEqual({
        ...mockCreatedData.get(),
        isDefault: false,
        outletPhotoId: 'photo-1',
      });
    });

    it('should handle empty string parameters', async () => {
      const mockDataEmpty = {
        ...mockCreatedData,
        get: jest.fn().mockReturnValue({
          id: 'photo-1',
          outletProfileMetadataId: '',
          cdnUrl: '',
          isActive: true,
          isDefault: false,
        }),
      };

      mockOutletProfilePhotoModel.create.mockResolvedValue(mockDataEmpty);

      const result = await service.insert('', '', false);

      expect(result).toEqual({
        id: 'photo-1',
        outletProfileMetadataId: '',
        cdnUrl: '',
        isActive: true,
        isDefault: false,
        outletPhotoId: 'photo-1',
      });
    });

    it('should handle null/undefined outletProfileId', async () => {
      const mockDataNull = {
        ...mockCreatedData,
        get: jest.fn().mockReturnValue({
          id: 'photo-1',
          outletProfileMetadataId: null,
          cdnUrl,
          isActive: true,
          isDefault: true,
        }),
      };

      mockOutletProfilePhotoModel.create.mockResolvedValue(mockDataNull);
      const resultNull = await service.insert(null as any, cdnUrl, isDefault);
      expect(resultNull.outletProfileMetadataId).toBe(null);

      const mockDataUndefined = {
        ...mockCreatedData,
        get: jest.fn().mockReturnValue({
          id: 'photo-1',
          outletProfileMetadataId: undefined,
          cdnUrl,
          isActive: true,
          isDefault: true,
        }),
      };

      mockOutletProfilePhotoModel.create.mockResolvedValue(mockDataUndefined);
      const resultUndefined = await service.insert(undefined as any, cdnUrl, isDefault);
      expect(resultUndefined.outletProfileMetadataId).toBe(undefined);
    });

    it('should log error and throw HttpException when database create fails', async () => {
      const dbError = new Error('Database connection failed');
      mockOutletProfilePhotoModel.create.mockRejectedValue(dbError);

      await expect(service.insert(outletProfileId, cdnUrl, isDefault)).rejects.toThrow(
        'Failed to insert the outlet profile image'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.insert error', { error: dbError });
    });

    it('should throw HttpException with INTERNAL_SERVER_ERROR status when insert fails', async () => {
      const error = new Error('Some error');
      mockOutletProfilePhotoModel.create.mockRejectedValue(error);

      try {
        await service.insert(outletProfileId, cdnUrl, isDefault);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(err.message).toBe('Failed to insert the outlet profile image');
      }
    });

    it('should handle database constraint violations', async () => {
      const constraintError = new Error('Validation error: duplicate key');
      mockOutletProfilePhotoModel.create.mockRejectedValue(constraintError);

      await expect(service.insert(outletProfileId, cdnUrl, isDefault)).rejects.toThrow(HttpException);

      expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.insert error', { error: constraintError });
    });
  });

  describe('deselectDefaultImage', () => {
    it('should successfully deselect default image', async () => {
      // Arrange
      const outletProfileId = 'outlet-123';
      const updateResult = [1]; // Sequelize update returns [affectedCount]

      mockOutletProfilePhotoModel.update.mockResolvedValue(updateResult);

      // Act
      const result = await service.deselectDefaultImage(outletProfileId);

      // Assert
      expect(mockOutletProfilePhotoModel.update).toHaveBeenCalledTimes(1);
      expect(mockOutletProfilePhotoModel.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { outletProfileMetadataId: outletProfileId } }
      );
      expect(result).toEqual(updateResult);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should successfully handle case when no records are updated', async () => {
      // Arrange
      const outletProfileId = 'non-existent-outlet';
      const updateResult = [0]; // No records updated

      mockOutletProfilePhotoModel.update.mockResolvedValue(updateResult);

      // Act
      const result = await service.deselectDefaultImage(outletProfileId);

      // Assert
      expect(mockOutletProfilePhotoModel.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { outletProfileMetadataId: outletProfileId } }
      );
      expect(result).toEqual(updateResult);
    });

    it('should handle empty string outletProfileId', async () => {
      // Arrange
      const outletProfileId = '';
      const updateResult = [0];

      mockOutletProfilePhotoModel.update.mockResolvedValue(updateResult);

      // Act
      const result = await service.deselectDefaultImage(outletProfileId);

      // Assert
      expect(mockOutletProfilePhotoModel.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { outletProfileMetadataId: '' } }
      );
      expect(result).toEqual(updateResult);
    });

    it('should handle null/undefined outletProfileId', async () => {
      // Arrange
      const updateResult = [0];

      mockOutletProfilePhotoModel.update.mockResolvedValue(updateResult);

      // Act & Assert for null
      const resultNull = await service.deselectDefaultImage(null as any);
      expect(mockOutletProfilePhotoModel.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { outletProfileMetadataId: null } }
      );

      // Act & Assert for undefined
      const resultUndefined = await service.deselectDefaultImage(undefined as any);
      expect(mockOutletProfilePhotoModel.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { outletProfileMetadataId: undefined } }
      );
    });

    it('should log error and throw HttpException when database update fails', async () => {
      // Arrange
      const outletProfileId = 'outlet-123';
      const dbError = new Error('Database connection timeout');

      mockOutletProfilePhotoModel.update.mockRejectedValue(dbError);

      // Act & Assert
      await expect(service.deselectDefaultImage(outletProfileId)).rejects.toThrow(HttpException);

      await expect(service.deselectDefaultImage(outletProfileId)).rejects.toThrow('Failed to deselect the default image');

      expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.deselectDefaultImage error', {
        error: dbError,
      });
    });

    it('should throw HttpException with INTERNAL_SERVER_ERROR status when update fails', async () => {
      // Arrange
      const outletProfileId = 'outlet-123';

      mockOutletProfilePhotoModel.update.mockRejectedValue(new Error('Some error'));

      // Act & Assert
      try {
        await service.deselectDefaultImage(outletProfileId);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.message).toBe('Failed to deselect the default image');
      }
    });

    it('should handle database constraint violations during update', async () => {
      // Arrange
      const outletProfileId = 'outlet-123';
      const constraintError = new Error('Foreign key constraint violation');

      mockOutletProfilePhotoModel.update.mockRejectedValue(constraintError);

      // Act & Assert
      await expect(service.deselectDefaultImage(outletProfileId)).rejects.toThrow(HttpException);

      expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.deselectDefaultImage error', {
        error: constraintError,
      });
    });

    it('should handle multiple records being updated', async () => {
      // Arrange
      const outletProfileId = 'outlet-123';
      const updateResult = [5]; // Multiple records updated

      mockOutletProfilePhotoModel.update.mockResolvedValue(updateResult);

      // Act
      const result = await service.deselectDefaultImage(outletProfileId);

      // Assert
      expect(result).toEqual(updateResult);
      expect(mockOutletProfilePhotoModel.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { outletProfileMetadataId: outletProfileId } }
      );
    });
  });

  describe('bulkDelete', () => {
    const validOutletProfileMetadataIds = ['outlet-profile-1', 'outlet-profile-2', 'outlet-profile-3'];

    describe('Success scenarios', () => {
      it('should successfully delete outlet profile photos for multiple IDs', async () => {
        // Arrange
        const deletedCount = 3;
        mockOutletProfilePhotoModel.destroy.mockResolvedValue(deletedCount);

        // Act
        const result = await service.bulkDelete(validOutletProfileMetadataIds);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('OutletProfilePhotoService.bulkDelete called', {
          outletProfileMetadataIds: validOutletProfileMetadataIds,
        });
        expect(mockOutletProfilePhotoModel.destroy).toHaveBeenCalledTimes(1);
        expect(mockOutletProfilePhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletProfileMetadataId: { [Op.in]: validOutletProfileMetadataIds },
            isDefault: true,
            isActive: true,
          },
        });
        expect(result).toBe(deletedCount);
      });

      it('should successfully delete with single outlet profile metadata ID', async () => {
        // Arrange
        const singleId = ['outlet-profile-1'];
        const deletedCount = 1;
        mockOutletProfilePhotoModel.destroy.mockResolvedValue(deletedCount);

        // Act
        const result = await service.bulkDelete(singleId);

        // Assert
        expect(mockOutletProfilePhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletProfileMetadataId: { [Op.in]: singleId },
            isDefault: true,
            isActive: true,
          },
        });
        expect(result).toBe(1);
      });

      it('should return 0 when no records are deleted', async () => {
        // Arrange
        mockOutletProfilePhotoModel.destroy.mockResolvedValue(0);

        // Act
        const result = await service.bulkDelete(validOutletProfileMetadataIds);

        // Assert
        expect(mockOutletProfilePhotoModel.destroy).toHaveBeenCalledTimes(1);
        expect(result).toBe(0);
      });

      it('should only delete photos with isDefault=true and isActive=true', async () => {
        // Arrange
        mockOutletProfilePhotoModel.destroy.mockResolvedValue(2);

        // Act
        await service.bulkDelete(validOutletProfileMetadataIds);

        // Assert
        const callArgs = mockOutletProfilePhotoModel.destroy.mock.calls[0][0];
        expect(callArgs.where.isDefault).toBe(true);
        expect(callArgs.where.isActive).toBe(true);
      });
    });

    describe('Empty or invalid input scenarios', () => {
      it('should handle empty array', async () => {
        // Arrange
        const emptyArray: string[] = [];
        mockOutletProfilePhotoModel.destroy.mockResolvedValue(0);

        // Act
        const result = await service.bulkDelete(emptyArray);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('OutletProfilePhotoService.bulkDelete called', {
          outletProfileMetadataIds: emptyArray,
        });
        expect(result).toBe(0);
      });
    });

    describe('Error handling scenarios', () => {
      it('should throw HttpException when database error occurs', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        mockOutletProfilePhotoModel.destroy.mockRejectedValue(dbError);

        // Act & Assert
        try {
          await service.bulkDelete(validOutletProfileMetadataIds);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Failed to bulkDelete the default image');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.bulkDelete error', {
          error: dbError,
        });
      });

      it('should log error and throw HttpException on unexpected error', async () => {
        // Arrange
        const unexpectedError = new Error('Unexpected error');
        mockOutletProfilePhotoModel.destroy.mockRejectedValue(unexpectedError);

        // Act & Assert
        await expect(service.bulkDelete(validOutletProfileMetadataIds)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.bulkDelete error', {
          error: unexpectedError,
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle very large array of outlet profile metadata IDs', async () => {
        // Arrange
        const largeIds = Array.from({ length: 1000 }, (_, i) => `outlet-profile-${i}`);
        mockOutletProfilePhotoModel.destroy.mockResolvedValue(500);

        // Act
        const result = await service.bulkDelete(largeIds);

        // Assert
        expect(mockOutletProfilePhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletProfileMetadataId: { [Op.in]: largeIds },
            isDefault: true,
            isActive: true,
          },
        });
        expect(result).toBe(500);
      });

      it('should handle outlet profile metadata IDs with special characters', async () => {
        // Arrange
        const specialIds = ['outlet-profile-1!@#', 'outlet-profile-2$%^', 'outlet-profile-3&*()'];
        mockOutletProfilePhotoModel.destroy.mockResolvedValue(3);

        // Act
        const result = await service.bulkDelete(specialIds);

        // Assert
        expect(mockOutletProfilePhotoModel.destroy).toHaveBeenCalledWith({
          where: {
            outletProfileMetadataId: { [Op.in]: specialIds },
            isDefault: true,
            isActive: true,
          },
        });
        expect(result).toBe(3);
      });
    });
  });

  describe('bulkInsert', () => {
    const validOutletProfileMetadataIds = ['outlet-profile-1', 'outlet-profile-2', 'outlet-profile-3'];
    const validCdnUrl = 'https://cdn.example.com/hero-image.jpg';
    const validIsDefault = true;

    describe('Success scenarios', () => {
      it('should successfully bulk insert outlet profile photos for multiple IDs', async () => {
        // Arrange
        const expectedRecords = validOutletProfileMetadataIds.map(id => ({
          outletProfileMetadataId: id,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        const mockCreatedRecords = expectedRecords.map((record, index) => ({ ...record, id: `photo-${index + 1}` }));
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(mockCreatedRecords);

        // Act
        const result = await service.bulkInsert(validOutletProfileMetadataIds, validCdnUrl, validIsDefault);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('OutletProfilePhotoService.bulkInsert called', {
          outletProfileMetadataIds: validOutletProfileMetadataIds,
        });
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledTimes(1);
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(mockCreatedRecords);
      });

      it('should successfully bulk insert with single outlet profile metadata ID', async () => {
        // Arrange
        const singleId = ['outlet-profile-1'];
        const expectedRecords = [
          {
            outletProfileMetadataId: 'outlet-profile-1',
            cdnUrl: validCdnUrl,
            isDefault: validIsDefault,
            isActive: true,
          },
        ];
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        const result = await service.bulkInsert(singleId, validCdnUrl, validIsDefault);

        // Assert
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });

      it('should set isDefault to false when provided', async () => {
        // Arrange
        const expectedRecords = validOutletProfileMetadataIds.map(id => ({
          outletProfileMetadataId: id,
          cdnUrl: validCdnUrl,
          isDefault: false,
          isActive: true,
        }));
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        await service.bulkInsert(validOutletProfileMetadataIds, validCdnUrl, false);

        // Assert
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
      });

      it('should always set isActive to true', async () => {
        // Arrange
        const expectedRecords = validOutletProfileMetadataIds.map(id => ({
          outletProfileMetadataId: id,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        await service.bulkInsert(validOutletProfileMetadataIds, validCdnUrl, validIsDefault);

        // Assert
        const callArg = mockOutletProfilePhotoModel.bulkCreate.mock.calls[0][0];
        callArg.forEach((record: any) => {
          expect(record.isActive).toBe(true);
        });
      });

      it('should handle empty array', async () => {
        // Arrange
        const emptyArray: string[] = [];
        const expectedRecords: any[] = [];
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        const result = await service.bulkInsert(emptyArray, validCdnUrl, validIsDefault);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('OutletProfilePhotoService.bulkInsert called', {
          outletProfileMetadataIds: emptyArray,
        });
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });
    });

    describe('Error handling scenarios', () => {
      it('should throw HttpException when database error occurs', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        mockOutletProfilePhotoModel.bulkCreate.mockRejectedValue(dbError);

        // Act & Assert
        try {
          await service.bulkInsert(validOutletProfileMetadataIds, validCdnUrl, validIsDefault);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Failed to insert the default image');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.bulkInsert error', {
          error: dbError,
        });
      });

      it('should log error and throw HttpException on validation error', async () => {
        // Arrange
        const validationError = new Error('Validation error: Invalid CDN URL');
        mockOutletProfilePhotoModel.bulkCreate.mockRejectedValue(validationError);

        // Act & Assert
        try {
          await service.bulkInsert(validOutletProfileMetadataIds, validCdnUrl, validIsDefault);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Failed to insert the default image');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.bulkInsert error', {
          error: validationError,
        });
      });

      it('should throw HttpException on constraint violation', async () => {
        // Arrange
        const constraintError = new Error('Unique constraint violation');
        mockOutletProfilePhotoModel.bulkCreate.mockRejectedValue(constraintError);

        // Act & Assert
        try {
          await service.bulkInsert(validOutletProfileMetadataIds, validCdnUrl, validIsDefault);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Failed to insert the default image');
          expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('OutletProfilePhotoService.bulkInsert error', {
          error: constraintError,
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle very large array of outlet profile metadata IDs', async () => {
        // Arrange
        const largeIds = Array.from({ length: 1000 }, (_, i) => `outlet-profile-${i}`);
        const expectedRecords = largeIds.map(id => ({
          outletProfileMetadataId: id,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        const result = await service.bulkInsert(largeIds, validCdnUrl, validIsDefault);

        // Assert
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toHaveLength(1000);
      });

      it('should handle outlet profile metadata IDs with special characters', async () => {
        // Arrange
        const specialIds = ['outlet-profile-1!@#', 'outlet-profile-2$%^', 'outlet-profile-3&*()'];
        const expectedRecords = specialIds.map(id => ({
          outletProfileMetadataId: id,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        const result = await service.bulkInsert(specialIds, validCdnUrl, validIsDefault);

        // Assert
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });

      it('should handle empty string CDN URL', async () => {
        // Arrange
        const expectedRecords = validOutletProfileMetadataIds.map(id => ({
          outletProfileMetadataId: id,
          cdnUrl: '',
          isDefault: validIsDefault,
          isActive: true,
        }));
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        const result = await service.bulkInsert(validOutletProfileMetadataIds, '', validIsDefault);

        // Assert
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });

      it('should handle very long CDN URL', async () => {
        // Arrange
        const longCdnUrl = 'https://cdn.example.com/' + 'a'.repeat(1000) + '.jpg';
        const expectedRecords = validOutletProfileMetadataIds.map(id => ({
          outletProfileMetadataId: id,
          cdnUrl: longCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
        }));
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        const result = await service.bulkInsert(validOutletProfileMetadataIds, longCdnUrl, validIsDefault);

        // Assert
        expect(mockOutletProfilePhotoModel.bulkCreate).toHaveBeenCalledWith(expectedRecords);
        expect(result).toEqual(expectedRecords);
      });
    });

    describe('Return value scenarios', () => {
      it('should return array of created records', async () => {
        // Arrange
        const expectedRecords = validOutletProfileMetadataIds.map((id, index) => ({
          id: `photo-${index + 1}`,
          outletProfileMetadataId: id,
          cdnUrl: validCdnUrl,
          isDefault: validIsDefault,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
        mockOutletProfilePhotoModel.bulkCreate.mockResolvedValue(expectedRecords);

        // Act
        const result = await service.bulkInsert(validOutletProfileMetadataIds, validCdnUrl, validIsDefault);

        // Assert
        expect(result).toEqual(expectedRecords);
        expect(result).toHaveLength(validOutletProfileMetadataIds.length);
        result.forEach((record: any, index: number) => {
          expect(record).toHaveProperty('id');
          expect(record).toHaveProperty('outletProfileMetadataId', validOutletProfileMetadataIds[index]);
          expect(record).toHaveProperty('cdnUrl', validCdnUrl);
          expect(record).toHaveProperty('isDefault', validIsDefault);
          expect(record).toHaveProperty('isActive', true);
        });
      });
    });
  });

  describe('Service Integration', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have OutletProfilePhotos model injected', () => {
      expect(service['outletProfilePhotoModel']).toBeDefined();
    });

    it('should have Logger injected', () => {
      expect(service['logger']).toBeDefined();
    });
  });
});
