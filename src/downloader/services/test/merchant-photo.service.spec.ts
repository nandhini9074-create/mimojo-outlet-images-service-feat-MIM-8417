import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { MerchantPhoto } from 'src/downloader/models/merchant-photo.model';
import { MerchantPhotoService } from '../merchant-photo.service';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

describe('MerchantPhotoService', () => {
  let service: MerchantPhotoService;
  let mockMerchantPhotoModel: any;
  let mockLogger: any;

  const mockMerchantPhoto = {
    id: '1',
    merchantId: 'merchant-123',
    cdnUrl: 'https://cdn.example.com/image.jpg',
    isActive: true,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Mock the MerchantPhoto model
    mockMerchantPhotoModel = {
      create: jest.fn(),
      update: jest.fn(),
    };

    // Mock the CustomPinoLogger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantPhotoService,
        {
          provide: getModelToken(MerchantPhoto),
          useValue: mockMerchantPhotoModel,
        },
        {
          provide: CustomPinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<MerchantPhotoService>(MerchantPhotoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('insert', () => {
    describe('Success scenarios', () => {
      it('should successfully insert a merchant photo with isDefault true', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const cdnUrl = 'https://cdn.example.com/image.jpg';
        const isDefault = true;

        mockMerchantPhotoModel.create.mockResolvedValue(mockMerchantPhoto);

        // Act
        const result = await service.insert(merchantId, cdnUrl, isDefault);

        // Assert
        expect(mockMerchantPhotoModel.create).toHaveBeenCalledWith({
          merchantId: merchantId,
          cdnUrl: cdnUrl,
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(mockMerchantPhoto);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should successfully insert a merchant photo with isDefault false', async () => {
        // Arrange
        const merchantId = 'merchant-456';
        const cdnUrl = 'https://cdn.example.com/another-image.jpg';
        const isDefault = false;
        const expectedPhoto = { ...mockMerchantPhoto, isDefault: false };

        mockMerchantPhotoModel.create.mockResolvedValue(expectedPhoto);

        // Act
        const result = await service.insert(merchantId, cdnUrl, isDefault);

        // Assert
        expect(mockMerchantPhotoModel.create).toHaveBeenCalledWith({
          merchantId: merchantId,
          cdnUrl: cdnUrl,
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(expectedPhoto);
      });

      it('should handle empty string merchantId', async () => {
        // Arrange
        const merchantId = '';
        const cdnUrl = 'https://cdn.example.com/image.jpg';
        const isDefault = true;

        mockMerchantPhotoModel.create.mockResolvedValue(mockMerchantPhoto);

        // Act
        const result = await service.insert(merchantId, cdnUrl, isDefault);

        // Assert
        expect(mockMerchantPhotoModel.create).toHaveBeenCalledWith({
          merchantId: '',
          cdnUrl: cdnUrl,
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(mockMerchantPhoto);
      });

      it('should handle empty string cdn_url', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const cdnUrl = '';
        const isDefault = false;

        mockMerchantPhotoModel.create.mockResolvedValue(mockMerchantPhoto);

        // Act
        const result = await service.insert(merchantId, cdnUrl, isDefault);

        // Assert
        expect(mockMerchantPhotoModel.create).toHaveBeenCalledWith({
          merchantId: merchantId,
          cdnUrl: '',
          isActive: true,
          isDefault: isDefault,
        });
        expect(result).toEqual(mockMerchantPhoto);
      });
    });

    describe('Error scenarios', () => {
      it('should handle database connection error', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const cdnUrl = 'https://cdn.example.com/image.jpg';
        const isDefault = true;
        const dbError = new Error('Database connection failed');

        mockMerchantPhotoModel.create.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.insert(merchantId, cdnUrl, isDefault)).rejects.toThrow(
          new HttpException('Failed to insert the merchant  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.insert error', { error: dbError });
      });

      it('should handle validation error from Sequelize', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const cdnUrl = 'https://cdn.example.com/image.jpg';
        const isDefault = true;
        const validationError = new Error('Validation error: merchantId cannot be null');

        mockMerchantPhotoModel.create.mockRejectedValue(validationError);

        // Act & Assert
        await expect(service.insert(merchantId, cdnUrl, isDefault)).rejects.toThrow(
          new HttpException('Failed to insert the merchant  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.insert error', { error: validationError });
      });

      it('should handle unique constraint violation', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const cdnUrl = 'https://cdn.example.com/image.jpg';
        const isDefault = true;
        const constraintError = new Error('Unique constraint violation');

        mockMerchantPhotoModel.create.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(service.insert(merchantId, cdnUrl, isDefault)).rejects.toThrow(
          new HttpException('Failed to insert the merchant  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.insert error', { error: constraintError });
      });

      it('should handle timeout error', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const cdnUrl = 'https://cdn.example.com/image.jpg';
        const isDefault = true;
        const timeoutError = new Error('Query timeout');

        mockMerchantPhotoModel.create.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(service.insert(merchantId, cdnUrl, isDefault)).rejects.toThrow(
          new HttpException('Failed to insert the merchant  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.insert error', { error: timeoutError });
      });
    });
  });

  describe('deselectDefaultImage', () => {
    describe('Success scenarios', () => {
      it('should successfully deselect default image for a merchant', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const updateResult = [2]; // Sequelize returns array with number of affected rows

        mockMerchantPhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(merchantId);

        // Assert
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { merchantId: merchantId } }
        );
        expect(result).toEqual(updateResult);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should handle case where no records are updated (merchant has no photos)', async () => {
        // Arrange
        const merchantId = 'non-existent-merchant';
        const updateResult = [0]; // No rows affected

        mockMerchantPhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(merchantId);

        // Assert
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { merchantId: merchantId } }
        );
        expect(result).toEqual(updateResult);
      });

      it('should handle empty string merchantId', async () => {
        // Arrange
        const merchantId = '';
        const updateResult = [0];

        mockMerchantPhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(merchantId);

        // Assert
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith({ isDefault: false }, { where: { merchantId: '' } });
        expect(result).toEqual(updateResult);
      });

      it('should handle single record update', async () => {
        // Arrange
        const merchantId = 'merchant-single-photo';
        const updateResult = [1]; // One row affected

        mockMerchantPhotoModel.update.mockResolvedValue(updateResult);

        // Act
        const result = await service.deselectDefaultImage(merchantId);

        // Assert
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(
          { isDefault: false },
          { where: { merchantId: merchantId } }
        );
        expect(result).toEqual(updateResult);
      });
    });

    describe('Error scenarios', () => {
      it('should handle database connection error', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const dbError = new Error('Database connection failed');

        mockMerchantPhotoModel.update.mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.deselectDefaultImage error', { error: dbError });
      });

      it('should handle foreign key constraint error', async () => {
        // Arrange
        const merchantId = 'invalid-merchant-id';
        const constraintError = new Error('Foreign key constraint fails');

        mockMerchantPhotoModel.update.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.deselectDefaultImage error', {
          error: constraintError,
        });
      });

      it('should handle query timeout error', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const timeoutError = new Error('Query execution timeout');

        mockMerchantPhotoModel.update.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.deselectDefaultImage error', {
          error: timeoutError,
        });
      });

      it('should handle generic database error', async () => {
        // Arrange
        const merchantId = 'merchant-123';
        const genericError = new Error('Database operation failed');

        mockMerchantPhotoModel.update.mockRejectedValue(genericError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.deselectDefaultImage error', {
          error: genericError,
        });
      });

      it('should handle null merchantId (if passed somehow)', async () => {
        // Arrange
        const merchantId = null as any;
        const nullError = new Error('Invalid merchantId');

        mockMerchantPhotoModel.update.mockRejectedValue(nullError);

        // Act & Assert
        await expect(service.deselectDefaultImage(merchantId)).rejects.toThrow(
          new HttpException('Failed to deselect  the default  image', HttpStatus.INTERNAL_SERVER_ERROR)
        );

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.deselectDefaultImage error', {
          error: nullError,
        });
      });
    });
  });

  describe('updateById', () => {
    const validId = 'photo-123';
    const validData: Partial<MerchantPhoto> = {
      isDefault: true,
    };

    describe('Success scenarios', () => {
      it('should successfully update merchant photo by id', async () => {
        // Arrange
        const updatedPhoto = { ...mockMerchantPhoto, isDefault: true };
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, validData);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledWith('MerchantPhotoService.updateById called', {
          id: validId,
          data: validData,
        });
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(validData, {
          where: { id: validId },
          returning: true,
          transaction: undefined,
        });
        expect(result).toEqual(updatedPhoto);
      });

      it('should successfully update merchant photo with transaction', async () => {
        // Arrange
        const mockTransaction = { id: 'transaction-123' };
        const updatedPhoto = { ...mockMerchantPhoto, isDefault: false };
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, validData, mockTransaction);

        // Assert
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(validData, {
          where: { id: validId },
          returning: true,
          transaction: mockTransaction,
        });
        expect(result).toEqual(updatedPhoto);
      });

      it('should update isDefault to true', async () => {
        // Arrange
        const data: Partial<MerchantPhoto> = { isDefault: true };
        const updatedPhoto = { ...mockMerchantPhoto, isDefault: true };
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, data);

        // Assert
        expect(result.isDefault).toBe(true);
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(data, {
          where: { id: validId },
          returning: true,
          transaction: undefined,
        });
      });

      it('should update isDefault to false', async () => {
        // Arrange
        const data: Partial<MerchantPhoto> = { isDefault: false };
        const updatedPhoto = { ...mockMerchantPhoto, isDefault: false };
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, data);

        // Assert
        expect(result.isDefault).toBe(false);
      });

      it('should update multiple fields', async () => {
        // Arrange
        const data: Partial<MerchantPhoto> = {
          isDefault: true,
          isActive: false,
          cdnUrl: 'https://new-cdn.example.com/image.jpg',
        };
        const updatedPhoto = { ...mockMerchantPhoto, ...data };
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, data);

        // Assert
        expect(result).toEqual(updatedPhoto);
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(data, {
          where: { id: validId },
          returning: true,
          transaction: undefined,
        });
      });

      it('should handle partial update with only isActive', async () => {
        // Arrange
        const data: Partial<MerchantPhoto> = { isActive: false };
        const updatedPhoto = { ...mockMerchantPhoto, isActive: false };
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, data);

        // Assert
        expect(result.isActive).toBe(false);
      });
    });

    describe('Error scenarios - No record found', () => {
      it('should throw NOT_FOUND HttpException when no record is updated', async () => {
        // Arrange
        mockMerchantPhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        try {
          await service.updateById(validId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantPhotoService.updateById no record found');
          expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        }

        expect(mockLogger.info).toHaveBeenCalledWith('MerchantPhotoService.updateById called', {
          id: validId,
          data: validData,
        });
      });

      it('should throw NOT_FOUND HttpException for non-existent id', async () => {
        // Arrange
        const nonExistentId = 'non-existent-photo-id';
        mockMerchantPhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        try {
          await service.updateById(nonExistentId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantPhotoService.updateById no record found');
          expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        }
      });
    });

    describe('Error scenarios - Database errors', () => {
      it('should throw BAD_REQUEST HttpException when database error occurs', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        mockMerchantPhotoModel.update.mockRejectedValue(dbError);

        // Act & Assert
        try {
          await service.updateById(validId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantPhotoService.updateById failed');
          expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.updateById error', {
          error: dbError,
        });
      });

      it('should handle validation error', async () => {
        // Arrange
        const validationError = new Error('Validation failed: invalid data');
        mockMerchantPhotoModel.update.mockRejectedValue(validationError);

        // Act & Assert
        try {
          await service.updateById(validId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantPhotoService.updateById failed');
          expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        }

        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.updateById error', {
          error: validationError,
        });
      });

      it('should handle constraint violation', async () => {
        // Arrange
        const constraintError = new Error('Unique constraint violation');
        mockMerchantPhotoModel.update.mockRejectedValue(constraintError);

        // Act & Assert
        await expect(service.updateById(validId, validData)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.updateById error', {
          error: constraintError,
        });
      });

      it('should handle timeout error', async () => {
        // Arrange
        const timeoutError = new Error('Query timeout');
        mockMerchantPhotoModel.update.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(service.updateById(validId, validData)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.updateById error', {
          error: timeoutError,
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string id', async () => {
        // Arrange
        const emptyId = '';
        mockMerchantPhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        try {
          await service.updateById(emptyId, validData);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('MerchantPhotoService.updateById no record found');
        }
      });

      it('should handle empty data object', async () => {
        // Arrange
        const emptyData = {};
        const updatedPhoto = mockMerchantPhoto;
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(validId, emptyData);

        // Assert
        expect(result).toEqual(updatedPhoto);
        expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(emptyData, {
          where: { id: validId },
          returning: true,
          transaction: undefined,
        });
      });

      it('should handle very long id', async () => {
        // Arrange
        const longId = 'photo-' + 'a'.repeat(1000);
        mockMerchantPhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        await expect(service.updateById(longId, validData)).rejects.toThrow(HttpException);
      });

      it('should handle special characters in id', async () => {
        // Arrange
        const specialId = 'photo-!@#$%^&*()';
        const updatedPhoto = { ...mockMerchantPhoto, id: specialId };
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        const result = await service.updateById(specialId, validData);

        // Assert
        expect(result).toEqual(updatedPhoto);
      });

      it('should handle null data fields', async () => {
        // Arrange
        const dataWithNull: Partial<MerchantPhoto> = {
          cdnUrl: null as any,
          isDefault: false,
        };
        const updatedPhoto = { ...mockMerchantPhoto, ...dataWithNull };
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

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
        const updatedPhoto = mockMerchantPhoto;
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        await service.updateById(validId, validData, mockTransaction);

        // Assert
        const callArgs = mockMerchantPhotoModel.update.mock.calls[0];
        expect(callArgs[1].transaction).toBe(mockTransaction);
      });

      it('should handle transaction rollback scenario', async () => {
        // Arrange
        const mockTransaction = { id: 'transaction-789', commit: jest.fn(), rollback: jest.fn() };
        const transactionError = new Error('Transaction rolled back');
        mockMerchantPhotoModel.update.mockRejectedValue(transactionError);

        // Act & Assert
        await expect(service.updateById(validId, validData, mockTransaction)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.updateById error', {
          error: transactionError,
        });
      });

      it('should work without transaction when not provided', async () => {
        // Arrange
        const updatedPhoto = mockMerchantPhoto;
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        await service.updateById(validId, validData);

        // Assert
        const callArgs = mockMerchantPhotoModel.update.mock.calls[0];
        expect(callArgs[1].transaction).toBeUndefined();
      });
    });

    describe('Logging scenarios', () => {
      it('should log info on method call', async () => {
        // Arrange
        const updatedPhoto = mockMerchantPhoto;
        mockMerchantPhotoModel.update.mockResolvedValue([1, [updatedPhoto]]);

        // Act
        await service.updateById(validId, validData);

        // Assert
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledWith('MerchantPhotoService.updateById called', {
          id: validId,
          data: validData,
        });
      });

      it('should log error when exception occurs', async () => {
        // Arrange
        const error = new Error('Some error');
        mockMerchantPhotoModel.update.mockRejectedValue(error);

        // Act & Assert
        await expect(service.updateById(validId, validData)).rejects.toThrow(HttpException);
        expect(mockLogger.error).toHaveBeenCalledWith('MerchantPhotoService.updateById error', {
          error: error,
        });
      });

      it('should log info even when no record found', async () => {
        // Arrange
        mockMerchantPhotoModel.update.mockResolvedValue([0, []]);

        // Act & Assert
        try {
          await service.updateById(validId, validData);
        } catch (error) {
          // Expected
        }

        expect(mockLogger.info).toHaveBeenCalledWith('MerchantPhotoService.updateById called', {
          id: validId,
          data: validData,
        });
      });
    });
  });

  describe('Constructor and Dependency Injection', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should inject dependencies correctly', () => {
      expect(service).toBeInstanceOf(MerchantPhotoService);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle consecutive method calls', async () => {
      // Arrange
      const merchantId = 'merchant-123';
      const cdnUrl = 'https://cdn.example.com/image.jpg';

      mockMerchantPhotoModel.update.mockResolvedValue([1]);
      mockMerchantPhotoModel.create.mockResolvedValue(mockMerchantPhoto);

      // Act
      await service.deselectDefaultImage(merchantId);
      const result = await service.insert(merchantId, cdnUrl, true);

      // Assert
      expect(mockMerchantPhotoModel.update).toHaveBeenCalledWith(
        { isDefault: false },
        { where: { merchantId: merchantId } }
      );
      expect(mockMerchantPhotoModel.create).toHaveBeenCalledWith({
        merchantId: merchantId,
        cdnUrl: cdnUrl,
        isActive: true,
        isDefault: true,
      });
      expect(result).toEqual(mockMerchantPhoto);
    });
  });
});
