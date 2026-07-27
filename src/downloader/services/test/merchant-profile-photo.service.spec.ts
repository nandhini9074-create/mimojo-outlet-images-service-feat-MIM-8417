import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { MerchantProfilePhoto } from 'src/downloader/models/merchant-profile-photo.entity';
import { MerchantProfilePhotoService } from '../merchant-profile-photo.service';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

describe('MerchantProfilePhotoService', () => {
  let service: MerchantProfilePhotoService;
  let mockMerchantProfilePhotoModel: any;
  let mockLogger: any;

  const mockMerchantProfilePhoto = {
    id: '123',
    merchantProfileMetadataId: 'merchant-123',
    cdnUrl: 'https://cdn.example.com/image.jpg',
    isActive: true,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Mock the Sequelize model
    mockMerchantProfilePhotoModel = {
      create: jest.fn(),
      update: jest.fn(),
    };

    // Mock the CustomPinoLogger
    mockLogger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantProfilePhotoService,
        {
          provide: getModelToken(MerchantProfilePhoto),
          useValue: mockMerchantProfilePhotoModel,
        },
        {
          provide: CustomPinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<MerchantProfilePhotoService>(MerchantProfilePhotoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('insert', () => {
    const merchantProfileId = 'merchant-123';
    const cdnUrl = 'https://cdn.example.com/image.jpg';

    describe('success scenarios', () => {
      it('should successfully insert a merchant profile photo with isDefault true', async () => {
        // Arrange
        const isDefault = true;
        mockMerchantProfilePhotoModel.create.mockResolvedValue(mockMerchantProfilePhoto);

        // Act
        const result = await service.insert(merchantProfileId, cdnUrl, isDefault);

        // Assert
        expect(mockMerchantProfilePhotoModel.create).toHaveBeenCalledWith({
          merchantProfileMetadataId: merchantProfileId,
          cdnUrl: cdnUrl,
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(mockMerchantProfilePhoto);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should successfully insert a merchant profile photo with isDefault false', async () => {
        // Arrange
        const isDefault = false;
        const mockPhotoWithDefaultFalse = { ...mockMerchantProfilePhoto, isDefault: false };
        mockMerchantProfilePhotoModel.create.mockResolvedValue(mockPhotoWithDefaultFalse);

        // Act
        const result = await service.insert(merchantProfileId, cdnUrl, isDefault);

        // Assert
        expect(mockMerchantProfilePhotoModel.create).toHaveBeenCalledWith({
          merchantProfileMetadataId: merchantProfileId,
          cdnUrl: cdnUrl,
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(mockPhotoWithDefaultFalse);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle empty string merchantProfileId', async () => {
        // Arrange
        const emptyMerchantProfileId = '';
        const isDefault = true;
        mockMerchantProfilePhotoModel.create.mockResolvedValue(mockMerchantProfilePhoto);

        // Act
        const result = await service.insert(emptyMerchantProfileId, cdnUrl, isDefault);

        // Assert
        expect(mockMerchantProfilePhotoModel.create).toHaveBeenCalledWith({
          merchantProfileMetadataId: emptyMerchantProfileId,
          cdnUrl: cdnUrl,
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(mockMerchantProfilePhoto);
      });

      it('should handle empty string cdnUrl', async () => {
        // Arrange
        const emptyCdnUrl = '';
        const isDefault = true;
        mockMerchantProfilePhotoModel.create.mockResolvedValue(mockMerchantProfilePhoto);

        // Act
        const result = await service.insert(merchantProfileId, emptyCdnUrl, isDefault);

        // Assert
        expect(mockMerchantProfilePhotoModel.create).toHaveBeenCalledWith({
          merchantProfileMetadataId: merchantProfileId,
          cdnUrl: emptyCdnUrl,
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(mockMerchantProfilePhoto);
      });
    });

    describe('error scenarios', () => {
      it('should handle database connection error', async () => {
        // Arrange
        const isDefault = true;
        const dbError = new Error('Database connection failed');
        mockMerchantProfilePhotoModel.create.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.insert(merchantProfileId, cdnUrl, isDefault)).rejects.toThrow(
          new HttpException('Failed to insert the merchant profile image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.insert error', { error: dbError });
        expect(mockMerchantProfilePhotoModel.create).toHaveBeenCalledWith({
          merchantProfileMetadataId: merchantProfileId,
          cdnUrl: cdnUrl,
          isActive: true,
          isDefault: isDefault,
        });
      });

      it('should handle validation error from Sequelize', async () => {
        // Arrange
        const isDefault = true;
        const validationError = new Error('Validation error: cdnUrl cannot be null');
        mockMerchantProfilePhotoModel.create.mockRejectedValue(validationError);

        // Act & Assert
        await expect(service.insert(merchantProfileId, cdnUrl, isDefault)).rejects.toThrow(
          new HttpException('Failed to insert the merchant profile image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.insert error', {
          error: validationError,
        });
      });

      it('should handle constraint violation error', async () => {
        // Arrange
        const isDefault = true;
        const constraintError = new Error('Foreign key constraint failed');
        mockMerchantProfilePhotoModel.create.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(service.insert(merchantProfileId, cdnUrl, isDefault)).rejects.toThrow(
          new HttpException('Failed to insert the merchant profile image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.insert error', {
          error: constraintError,
        });
      });

      it('should handle unexpected error', async () => {
        // Arrange
        const isDefault = true;
        const unexpectedError = new Error('Unexpected server error');
        mockMerchantProfilePhotoModel.create.mockRejectedValue(unexpectedError);

        // Act & Assert
        await expect(service.insert(merchantProfileId, cdnUrl, isDefault)).rejects.toThrow(
          new HttpException('Failed to insert the merchant profile image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.insert error', {
          error: unexpectedError,
        });
      });
    });
  });

  describe('deselectDefaultImage', () => {
    const merchantProfileId = 'merchant-123';

    describe('success scenarios', () => {
      it('should successfully deselect default image', async () => {
        // Arrange
        const updateResult = [1]; // Sequelize update returns array with number of affected rows
        mockMerchantProfilePhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(merchantProfileId);

        // Assert
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { id: merchantProfileId } }
        );
        expect(result).toEqual(updateResult);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle case when no records are updated (merchantProfileId not found)', async () => {
        // Arrange
        const updateResult = [0]; // No rows affected
        mockMerchantProfilePhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(merchantProfileId);

        // Assert
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { id: merchantProfileId } }
        );
        expect(result).toEqual(updateResult);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle multiple records updated', async () => {
        // Arrange
        const updateResult = [3]; // Multiple rows affected
        mockMerchantProfilePhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(merchantProfileId);

        // Assert
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { id: merchantProfileId } }
        );
        expect(result).toEqual(updateResult);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle empty string merchantProfileId', async () => {
        // Arrange
        const emptyMerchantProfileId = '';
        const updateResult = [0];
        mockMerchantProfilePhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(emptyMerchantProfileId);

        // Assert
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { id: emptyMerchantProfileId } }
        );
        expect(result).toEqual(updateResult);
      });
    });

    describe('error scenarios', () => {
      it('should handle database connection error', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantProfileId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.deselectDefaultImage error', {
          error: dbError,
        });
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { id: merchantProfileId } }
        );
      });

      it('should handle constraint violation error', async () => {
        // Arrange
        const constraintError = new Error('Check constraint violation');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantProfileId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.deselectDefaultImage error', {
          error: constraintError,
        });
      });

      it('should handle timeout error', async () => {
        // Arrange
        const timeoutError = new Error('Query timeout');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantProfileId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.deselectDefaultImage error', {
          error: timeoutError,
        });
      });

      it('should handle unexpected error', async () => {
        // Arrange
        const unexpectedError = new Error('Unexpected server error');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(unexpectedError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantProfileId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.deselectDefaultImage error', {
          error: unexpectedError,
        });
      });
    });
  });

  describe('updateById', () => {
    const validId = 'photo-123';
    const validData: Partial<MerchantProfilePhoto> = {
      isDefault: true,
    };

    beforeEach(() => {
      mockLogger.info = jest.fn();
    });

    describe('Success scenarios', () => {
      it('should successfully update merchant profile photo by id', async () => {
        // Arrange
        const updatedPhoto = { ...mockMerchantProfilePhoto, isDefault: true };
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, validData);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById called', {
          id: validId,
          data: validData,
        });
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(validData, {
          where: { id: validId },
          returning: true,
          transaction: undefined,
        });
        expect(result).toEqual(updatedPhoto);
      });

      it('should successfully update merchant profile photo with transaction', async () => {
        // Arrange
        const mockTransaction = { id: 'transaction-123' };
        const updatedPhoto = { ...mockMerchantProfilePhoto, isDefault: false };
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, validData, mockTransaction);

        // Assert
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(validData, {
          where: { id: validId },
          returning: true,
          transaction: mockTransaction,
        });
        expect(result).toEqual(updatedPhoto);
      });

      it('should update isDefault to true', async () => {
        // Arrange
        const data: Partial<MerchantProfilePhoto> = { isDefault: true };
        const updatedPhoto = { ...mockMerchantProfilePhoto, isDefault: true };
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, data);

        // Assert
        expect(result.isDefault).toBe(true);
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(data, {
          where: { id: validId },
          returning: true,
          transaction: undefined,
        });
      });

      it('should update isDefault to false', async () => {
        // Arrange
        const data: Partial<MerchantProfilePhoto> = { isDefault: false };
        const updatedPhoto = { ...mockMerchantProfilePhoto, isDefault: false };
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, data);

        // Assert
        expect(result.isDefault).toBe(false);
      });

      it('should update multiple fields', async () => {
        // Arrange
        const data: Partial<MerchantProfilePhoto> = {
          isDefault: true,
          isActive: false,
          cdnUrl: 'https://new-cdn.example.com/image.jpg',
        };
        const updatedPhoto = { ...mockMerchantProfilePhoto, ...data };
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, data);

        // Assert
        expect(result).toEqual(updatedPhoto);
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(data, {
          where: { id: validId },
          returning: true,
          transaction: undefined,
        });
      });

      it('should handle partial update with only isActive', async () => {
        // Arrange
        const data: Partial<MerchantProfilePhoto> = { isActive: false };
        const updatedPhoto = { ...mockMerchantProfilePhoto, isActive: false };
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, data);

        // Assert
        expect(result.isActive).toBe(false);
      });
    });

    describe('Error scenarios - No record found', () => {
      it('should throw NOT_FOUND HttpException when no record is updated', async () => {
        // Arrange
        mockMerchantProfilePhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        try {
          await service.updateById(validId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantProfilePhotoService.updateById no record found');
          expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        }

        expect(mockLogger.info).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById called', {
          id: validId,
          data: validData,
        });
      });

      it('should throw NOT_FOUND HttpException for non-existent id', async () => {
        // Arrange
        const nonExistentId = 'non-existent-photo-id';
        mockMerchantProfilePhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        try {
          await service.updateById(nonExistentId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantProfilePhotoService.updateById no record found');
          expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        }
      });
    });

    describe('Error scenarios - Database errors', () => {
      it('should throw BAD_REQUEST HttpException when database error occurs', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(dbError);

        // Act & Assert
        try {
          await service.updateById(validId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantProfilePhotoService.updateById failed');
          expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById error', {
          error: dbError,
        });
      });

      it('should handle validation error', async () => {
        // Arrange
        const validationError = new Error('Validation failed: invalid data');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(validationError);

        // Act & Assert
        try {
          await service.updateById(validId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantProfilePhotoService.updateById failed');
          expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById error', {
          error: validationError,
        });
      });

      it('should handle constraint violation', async () => {
        // Arrange
        const constraintError = new Error('Unique constraint violation');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(service.updateById(validId, validData)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById error', {
          error: constraintError,
        });
      });

      it('should handle timeout error', async () => {
        // Arrange
        const timeoutError = new Error('Query timeout');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(service.updateById(validId, validData)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById error', {
          error: timeoutError,
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string id', async () => {
        // Arrange
        const emptyId = '';
        mockMerchantProfilePhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        try {
          await service.updateById(emptyId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantProfilePhotoService.updateById no record found');
        }
      });

      it('should handle empty data object', async () => {
        // Arrange
        const emptyData = {};
        const updatedPhoto = mockMerchantProfilePhoto;
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, emptyData);

        // Assert
        expect(result).toEqual(updatedPhoto);
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(emptyData, {
          where: { id: validId },
          returning: true,
          transaction: undefined,
        });
      });

      it('should handle very long id', async () => {
        // Arrange
        const longId = 'photo-' + 'a'.repeat(1000);
        mockMerchantProfilePhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        await expect(service.updateById(longId, validData)).rejects.toThrow(HttpException);
      });

      it('should handle special characters in id', async () => {
        // Arrange
        const specialId = 'photo-!@#$%^&*()';
        const updatedPhoto = { ...mockMerchantProfilePhoto, id: specialId };
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(specialId, validData);

        // Assert
        expect(result).toEqual(updatedPhoto);
      });

      it('should handle null data fields', async () => {
        // Arrange
        const dataWithNull: Partial<MerchantProfilePhoto> = {
          cdnUrl: null as any,
          isDefault: false,
        };
        const updatedPhoto = { ...mockMerchantProfilePhoto, ...dataWithNull };
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, dataWithNull);

        // Assert
        expect(result).toEqual(updatedPhoto);
      });
    });

    describe('Transaction scenarios', () => {
      it('should pass transaction to the update call', async () => {
        // Arrange
        const mockTransaction = { id: 'transaction-456', commit: jest.fn(), rollback: jest.fn() };
        const updatedPhoto = mockMerchantProfilePhoto;
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        await service.updateById(validId, validData, mockTransaction);

        // Assert
        const callArgs = mockMerchantProfilePhotoModel.update.mock.calls[0];
        expect(callArgs[1].transaction).toBe(mockTransaction);
      });

      it('should handle transaction rollback scenario', async () => {
        // Arrange
        const mockTransaction = { id: 'transaction-789', commit: jest.fn(), rollback: jest.fn() };
        const transactionError = new Error('Transaction rolled back');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(transactionError);

        // Act & Assert
        await expect(service.updateById(validId, validData, mockTransaction)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById error', {
          error: transactionError,
        });
      });

      it('should work without transaction when not provided', async () => {
        // Arrange
        const updatedPhoto = mockMerchantProfilePhoto;
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        await service.updateById(validId, validData);

        // Assert
        const callArgs = mockMerchantProfilePhotoModel.update.mock.calls[0];
        expect(callArgs[1].transaction).toBeUndefined();
      });
    });

    describe('Logging scenarios', () => {
      it('should log info on method call', async () => {
        // Arrange
        const updatedPhoto = mockMerchantProfilePhoto;
        mockMerchantProfilePhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        await service.updateById(validId, validData);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById called', {
          id: validId,
          data: validData,
        });
      });

      it('should log error when exception occurs', async () => {
        // Arrange
        const error = new Error('Some error');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(error);

        // Act & Assert
        await expect(service.updateById(validId, validData)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById error', {
          error: error,
        });
      });

      it('should log info even when no record found', async () => {
        // Arrange
        mockMerchantProfilePhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        try {
          await service.updateById(validId, validData);
        } catch (error) {
          // Expected
        }

        expect(mockLogger.info).toHaveBeenCalledWith('MerchantProfilePhotoService.updateById called', {
          id: validId,
          data: validData,
        });
      });
    });
  });

  describe('edge cases and boundary conditions', () => {
    describe('insert method edge cases', () => {
      it('should handle null values gracefully', async () => {
        // Arrange
        const nullError = new Error('Cannot read property of null');
        mockMerchantProfilePhotoModel.create.mockRejectedValue(nullError);

        // Act & Assert
        await expect(service.insert(null as any, null as any, null as any)).rejects.toThrow(
          new HttpException('Failed to insert the merchant profile image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.insert error', { error: nullError });
      });

      it('should handle very long strings', async () => {
        // Arrange
        const longString = 'a'.repeat(1000);
        const isDefault = true;
        mockMerchantProfilePhotoModel.create.mockResolvedValue(mockMerchantProfilePhoto);

        // Act
        const result = await service.insert(longString, longString, isDefault);

        // Assert
        expect(mockMerchantProfilePhotoModel.create).toHaveBeenCalledWith({
          merchantProfileMetadataId: longString,
          cdnUrl: longString,
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(mockMerchantProfilePhoto);
      });
    });

    describe('deselectDefaultImage method edge cases', () => {
      it('should handle null merchantProfileId', async () => {
        // Arrange
        const nullError = new Error('Cannot read property of null');
        mockMerchantProfilePhotoModel.update.mockRejectedValue(nullError);

        // Act & Assert
        await expect(service.deselectDefaultImage(null as any)).rejects.toThrow(
          new HttpException('Failed to deselect  the default image ', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantProfilePhotoService.deselectDefaultImage error', {
          error: nullError,
        });
      });

      it('should handle very long merchantProfileId', async () => {
        // Arrange
        const longMerchantProfileId = 'a'.repeat(1000);
        const updateResult = [0];
        mockMerchantProfilePhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(longMerchantProfileId);

        // Assert
        expect(mockMerchantProfilePhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { id: longMerchantProfileId } }
        );
        expect(result).toEqual(updateResult);
      });
    });
  });

  describe('service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have merchantProfilePhoto model injected', () => {
      expect(service['merchantProfilePhoto']).toBeDefined();
    });

    it('should have logger injected', () => {
      expect(service['logger']).toBeDefined();
    });
  });
});
