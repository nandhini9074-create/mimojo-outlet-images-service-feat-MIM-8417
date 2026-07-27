import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Merchant } from 'src/downloader/models/merchant.model';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { MerchantService } from '../merchant.service';
import { Op } from 'sequelize';

describe('MerchantService', () => {
  let service: MerchantService;
  let mockMerchantRepository: { findAll: jest.Mock };
  let mockCdnUploadService: { uploadToCdn: jest.Mock };
  let mockLogger: { error: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const flushPromises = async () => {
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);
  };

  beforeEach(async () => {
    mockMerchantRepository = {
      findAll: jest.fn(),
    };

    mockCdnUploadService = {
      uploadToCdn: jest.fn(),
    };

    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantService,
        {
          provide: getModelToken(Merchant),
          useValue: mockMerchantRepository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'blob') {
                return {
                  BLOB_URL: 'https://test.blob.core.windows.net/container',
                };
              }

              return null;
            }),
          },
        },
        {
          provide: CdnUploadService,
          useValue: mockCdnUploadService,
        },
        {
          provide: CustomPinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<MerchantService>(MerchantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startMerchantLogosToCdnMigration', () => {
    it('should include invalid blob url merchant ids in completed job summary', async () => {
      const merchants = [
        {
          id: 'merchant-invalid',
          imageUrl: 'https://cdn.example.com/logo.jpg',
          update: jest.fn(),
        },
        {
          id: 'merchant-valid',
          imageUrl: 'https://test.blob.core.windows.net/container/logo.jpg?token=123',
          update: jest.fn().mockResolvedValue(undefined),
        },
      ];

      mockMerchantRepository.findAll.mockResolvedValueOnce(merchants).mockResolvedValueOnce([]);
      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.example.com/new-logo.jpg'] } })
      );

      const result = service.startMerchantLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus).toMatchObject({
        jobId: result.jobId,
        status: 'completed',
        input: {
          batchSize: 100,
        },
        summary: {
          total: 2,
          migrated: 1,
          skipped: 1,
          failed: 0,
          batchSize: 100,
          invalidBlobUrlMerchantIds: ['merchant-invalid'],
          failures: [],
        },
      });
      expect(mockMerchantRepository.findAll).toHaveBeenCalledWith({
        attributes: ['id', 'imageUrl'],
        where: {
          imageUrl: {
            [Op.ne]: null,
          },
        },
        limit: 100,
        offset: 0,
        order: [['id', 'ASC']],
      });
      expect(mockMerchantRepository.findAll).toHaveBeenCalledTimes(2);
      expect(merchants[1].update).toHaveBeenCalledWith({ imageUrl: 'https://cdn.example.com/new-logo.jpg' });
    });

    it('should include failed merchant ids separately from skipped ids in completed job summary', async () => {
      const merchants = [
        {
          id: 'merchant-failed',
          imageUrl: 'https://test.blob.core.windows.net/container/logo.jpg?token=123',
          update: jest.fn(),
        },
      ];

      mockMerchantRepository.findAll.mockResolvedValueOnce(merchants).mockResolvedValueOnce([]);
      mockCdnUploadService.uploadToCdn.mockRejectedValue(new Error('CDN upload failed'));

      const result = service.startMerchantLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus).toMatchObject({
        jobId: result.jobId,
        status: 'completed',
        summary: {
          total: 1,
          migrated: 0,
          skipped: 0,
          failed: 1,
          batchSize: 100,
          invalidBlobUrlMerchantIds: [],
          failures: [{ merchantId: 'merchant-failed', reason: 'CDN upload failed' }],
        },
      });
      expect(mockLogger.error).toHaveBeenCalledWith('MerchantService.migrateMerchantLogosToCdn failed', {
        merchantId: 'merchant-failed',
        imageUrl: 'https://test.blob.core.windows.net/container/logo.jpg?token=123',
        error: expect.any(Error),
      });
    });

    it('should mark merchant as failed when CDN response has no variants url', async () => {
      const merchants = [
        {
          id: 'merchant-no-variant',
          imageUrl: 'https://test.blob.core.windows.net/container/logo.jpg?token=123',
          update: jest.fn(),
        },
      ];

      mockMerchantRepository.findAll.mockResolvedValueOnce(merchants).mockResolvedValueOnce([]);
      mockCdnUploadService.uploadToCdn.mockResolvedValue(JSON.stringify({ result: { variants: [] } }));

      const result = service.startMerchantLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus).toMatchObject({
        jobId: result.jobId,
        status: 'completed',
        summary: {
          total: 1,
          migrated: 0,
          skipped: 0,
          failed: 1,
          batchSize: 100,
          invalidBlobUrlMerchantIds: [],
          failures: [{ merchantId: 'merchant-no-variant', reason: 'CDN response missing variants[0]' }],
        },
      });
      expect(merchants[0].update).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('MerchantService.migrateMerchantLogosToCdn invalid CDN response', {
        merchantId: 'merchant-no-variant',
        imageUrl: 'https://test.blob.core.windows.net/container/logo.jpg?token=123',
        cdnResponse: JSON.stringify({ result: { variants: [] } }),
      });
    });

    it('should use provided batch size with pagination', async () => {
      const firstBatch = [
        {
          id: 'merchant-1',
          imageUrl: 'https://test.blob.core.windows.net/container/logo-1.jpg?token=123',
          update: jest.fn().mockResolvedValue(undefined),
        },
      ];

      const secondBatch = [
        {
          id: 'merchant-2',
          imageUrl: 'https://test.blob.core.windows.net/container/logo-2.jpg?token=123',
          update: jest.fn().mockResolvedValue(undefined),
        },
      ];

      mockMerchantRepository.findAll
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce(secondBatch)
        .mockResolvedValueOnce([]);

      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.example.com/new-logo.jpg'] } })
      );

      const result = service.startMerchantLogosToCdnMigration(1);
      await flushPromises();
      const jobStatus = service.getMerchantLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus).toMatchObject({
        jobId: result.jobId,
        status: 'completed',
        input: {
          batchSize: 1,
        },
        summary: {
          total: 2,
          migrated: 2,
          skipped: 0,
          failed: 0,
          batchSize: 1,
          invalidBlobUrlMerchantIds: [],
          failures: [],
        },
      });

      expect(mockMerchantRepository.findAll).toHaveBeenNthCalledWith(1, {
        attributes: ['id', 'imageUrl'],
        where: {
          imageUrl: {
            [Op.ne]: null,
          },
        },
        limit: 1,
        offset: 0,
        order: [['id', 'ASC']],
      });

      expect(mockMerchantRepository.findAll).toHaveBeenNthCalledWith(2, {
        attributes: ['id', 'imageUrl'],
        where: {
          imageUrl: {
            [Op.ne]: null,
          },
        },
        limit: 1,
        offset: 1,
        order: [['id', 'ASC']],
      });
    });

    it('should return null for unknown job status', () => {
      expect(service.getMerchantLogosToCdnMigrationStatus('missing-job')).toBeNull();
    });

    it('should mark job as failed when migration throws', async () => {
      mockMerchantRepository.findAll.mockRejectedValue(new Error('query failed'));

      const result = service.startMerchantLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus?.status).toBe('failed');
      expect(jobStatus?.error).toBe('query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'MerchantService.runMerchantLogoMigrationJob failed',
        expect.objectContaining({
          jobId: result.jobId,
          error: expect.any(Error),
        })
      );
    });

    it('should skip merchant when imageUrl is null in record', async () => {
      const merchants = [
        {
          id: 'merchant-null-image',
          imageUrl: null,
          update: jest.fn(),
        },
      ];
      mockMerchantRepository.findAll.mockResolvedValueOnce(merchants).mockResolvedValueOnce([]);

      const result = service.startMerchantLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus?.summary).toMatchObject({
        total: 1,
        migrated: 0,
        skipped: 1,
        failed: 0,
      });
      expect(mockCdnUploadService.uploadToCdn).not.toHaveBeenCalled();
    });

    it('should normalize oversized batch size to max', async () => {
      mockMerchantRepository.findAll.mockResolvedValue([]);

      const result = service.startMerchantLogosToCdnMigration(5000);
      await flushPromises();
      const jobStatus = service.getMerchantLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus?.input.batchSize).toBe(1000);
      expect(jobStatus?.summary?.batchSize).toBe(1000);
    });
  });

  describe('job tracking and URL helpers', () => {
    it('run job should return when job is missing', async () => {
      await expect((service as any).runMerchantLogoMigrationJob('missing-job', 10)).resolves.toBeUndefined();
    });

    it('isBlobUrl should return false for empty string', () => {
      expect((service as any).isBlobUrl('')).toBe(false);
    });

    it('trimTrackedJobs should drop oldest entries above max', () => {
      const jobsMap: Map<string, any> = (service as any).migrationJobs;
      for (let index = 0; index < 53; index += 1) {
        jobsMap.set(`job-${index}`, {
          jobId: `job-${index}`,
          status: 'queued',
          createdAt: `2024-01-01T00:00:${String(index).padStart(3, '0')}Z`,
          input: { batchSize: 100 },
        });
      }

      (service as any).trimTrackedJobs();

      expect(jobsMap.size).toBe(50);
      expect(jobsMap.has('job-0')).toBe(false);
      expect(jobsMap.has('job-1')).toBe(false);
      expect(jobsMap.has('job-2')).toBe(false);
      expect(jobsMap.has('job-3')).toBe(true);
    });
  });
});
