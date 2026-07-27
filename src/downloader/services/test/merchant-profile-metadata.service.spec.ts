import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { MerchantProfileMetadata } from 'src/downloader/models/merchant-profile-metadata.model';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { MerchantProfileMetadataService } from '../merchant-profile-metadata.service';

describe('MerchantProfileMetadataService', () => {
  let service: MerchantProfileMetadataService;
  let mockMerchantProfileMetadataRepository: { findAll: jest.Mock };
  let mockCdnUploadService: { uploadToCdn: jest.Mock };
  let mockLogger: { error: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const flushPromises = async () => {
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);
  };

  beforeEach(async () => {
    mockMerchantProfileMetadataRepository = {
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
        MerchantProfileMetadataService,
        {
          provide: getModelToken(MerchantProfileMetadata),
          useValue: mockMerchantProfileMetadataRepository,
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

    service = module.get<MerchantProfileMetadataService>(MerchantProfileMetadataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startMerchantProfileMetadataLogosToCdnMigration', () => {
    it('should migrate merchant profile metadata logos with optional profile filter', async () => {
      const merchantProfiles = [
        {
          id: 'metadata-1',
          profileId: 'profile-123',
          imageUrl: 'https://test.blob.core.windows.net/container/logo.jpg?token=123',
          update: jest.fn().mockResolvedValue(undefined),
        },
      ];

      mockMerchantProfileMetadataRepository.findAll.mockResolvedValueOnce(merchantProfiles).mockResolvedValueOnce([]);
      mockCdnUploadService.uploadToCdn.mockResolvedValue(
        JSON.stringify({ result: { variants: ['https://cdn.example.com/profile-logo.jpg'] } })
      );

      const result = service.startMerchantProfileMetadataLogosToCdnMigration('profile-123', 25);
      await flushPromises();
      const jobStatus = service.getMerchantProfileMetadataLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus).toMatchObject({
        jobId: result.jobId,
        status: 'completed',
        input: {
          profileId: 'profile-123',
          batchSize: 25,
        },
        summary: {
          total: 1,
          migrated: 1,
          skipped: 0,
          failed: 0,
          batchSize: 25,
          profileId: 'profile-123',
          invalidBlobUrlMerchantProfileMetadataIds: [],
          failures: [],
        },
      });

      expect(mockMerchantProfileMetadataRepository.findAll).toHaveBeenNthCalledWith(1, {
        attributes: ['id', 'profileId', 'imageUrl'],
        where: {
          imageUrl: {
            [Op.ne]: null,
          },
          profileId: 'profile-123',
        },
        limit: 25,
        offset: 0,
        order: [['id', 'ASC']],
      });
      expect(merchantProfiles[0].update).toHaveBeenCalledWith({ imageUrl: 'https://cdn.example.com/profile-logo.jpg' });
    });

    it('should track invalid blob urls for merchant profile metadata rows', async () => {
      const merchantProfiles = [
        {
          id: 'metadata-invalid',
          profileId: 'profile-555',
          imageUrl: 'https://cdn.example.com/logo.jpg',
          update: jest.fn(),
        },
      ];

      mockMerchantProfileMetadataRepository.findAll.mockResolvedValueOnce(merchantProfiles).mockResolvedValueOnce([]);

      const result = service.startMerchantProfileMetadataLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantProfileMetadataLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus).toMatchObject({
        jobId: result.jobId,
        status: 'completed',
        summary: {
          total: 1,
          migrated: 0,
          skipped: 1,
          failed: 0,
          batchSize: 100,
          profileId: null,
          invalidBlobUrlMerchantProfileMetadataIds: ['metadata-invalid'],
          failures: [],
        },
      });
      expect(merchantProfiles[0].update).not.toHaveBeenCalled();
    });

    it('should return null for unknown job status', () => {
      expect(service.getMerchantProfileMetadataLogosToCdnMigrationStatus('missing-job')).toBeNull();
    });

    it('should mark job as failed when migration throws error', async () => {
      mockMerchantProfileMetadataRepository.findAll.mockRejectedValue(new Error('query failed'));

      const result = service.startMerchantProfileMetadataLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantProfileMetadataLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus?.status).toBe('failed');
      expect(jobStatus?.error).toBe('query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'MerchantProfileMetadataService.runMerchantProfileMetadataMigrationJob failed',
        expect.objectContaining({
          jobId: result.jobId,
          error: expect.any(Error),
        })
      );
    });

    it('should fail row migration when CDN response has no variants[0]', async () => {
      const merchantProfiles = [
        {
          id: 'metadata-no-variant',
          profileId: 'profile-123',
          imageUrl: 'https://test.blob.core.windows.net/container/logo.jpg?token=123',
          update: jest.fn(),
        },
      ];
      mockMerchantProfileMetadataRepository.findAll.mockResolvedValueOnce(merchantProfiles).mockResolvedValueOnce([]);
      mockCdnUploadService.uploadToCdn.mockResolvedValue(JSON.stringify({ result: { variants: [] } }));

      const result = service.startMerchantProfileMetadataLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantProfileMetadataLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus?.summary).toMatchObject({
        total: 1,
        migrated: 0,
        skipped: 0,
        failed: 1,
        failures: [
          {
            merchantProfileMetadataId: 'metadata-no-variant',
            profileId: 'profile-123',
            reason: 'CDN response missing variants[0]',
          },
        ],
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'MerchantProfileMetadataService.migrateMerchantProfileMetadataLogosToCdn invalid CDN response',
        expect.objectContaining({
          merchantProfileMetadataId: 'metadata-no-variant',
          profileId: 'profile-123',
        })
      );
    });

    it('should include thrown errors in failed summary', async () => {
      const merchantProfiles = [
        {
          id: 'metadata-failed',
          profileId: 'profile-err',
          imageUrl: 'https://test.blob.core.windows.net/container/logo.jpg?token=123',
          update: jest.fn(),
        },
      ];
      mockMerchantProfileMetadataRepository.findAll.mockResolvedValueOnce(merchantProfiles).mockResolvedValueOnce([]);
      mockCdnUploadService.uploadToCdn.mockRejectedValue(new Error('cdn timeout'));

      const result = service.startMerchantProfileMetadataLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantProfileMetadataLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus?.summary).toMatchObject({
        failed: 1,
        failures: [
          {
            merchantProfileMetadataId: 'metadata-failed',
            profileId: 'profile-err',
            reason: 'cdn timeout',
          },
        ],
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'MerchantProfileMetadataService.migrateMerchantProfileMetadataLogosToCdn failed',
        expect.objectContaining({
          merchantProfileMetadataId: 'metadata-failed',
          profileId: 'profile-err',
          error: expect.any(Error),
        })
      );
    });

    it('should skip row when imageUrl is null in returned record', async () => {
      const merchantProfiles = [
        {
          id: 'metadata-null-image',
          profileId: 'profile-123',
          imageUrl: null,
          update: jest.fn(),
        },
      ];
      mockMerchantProfileMetadataRepository.findAll.mockResolvedValueOnce(merchantProfiles).mockResolvedValueOnce([]);

      const result = service.startMerchantProfileMetadataLogosToCdnMigration();
      await flushPromises();
      const jobStatus = service.getMerchantProfileMetadataLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus?.summary).toMatchObject({
        total: 1,
        skipped: 1,
        migrated: 0,
      });
      expect(mockCdnUploadService.uploadToCdn).not.toHaveBeenCalled();
    });

    it('should normalize oversized batch size to max', async () => {
      mockMerchantProfileMetadataRepository.findAll.mockResolvedValue([]);

      const result = service.startMerchantProfileMetadataLogosToCdnMigration(undefined, 9999);
      await flushPromises();
      const jobStatus = service.getMerchantProfileMetadataLogosToCdnMigrationStatus(result.jobId);

      expect(jobStatus?.input.batchSize).toBe(1000);
      expect(jobStatus?.summary?.batchSize).toBe(1000);
    });
  });

  describe('job tracking and URL helpers', () => {
    it('run job should return when job is missing', async () => {
      await expect(
        (service as any).runMerchantProfileMetadataMigrationJob('missing-job', undefined, 10)
      ).resolves.toBeUndefined();
    });

    it('isBlobUrl should return false for empty url', () => {
      expect((service as any).isBlobUrl('')).toBe(false);
    });

    it('trimTrackedJobs should remove oldest overflow jobs', () => {
      const jobsMap: Map<string, any> = (service as any).migrationJobs;
      for (let index = 0; index < 205; index += 1) {
        jobsMap.set(`job-${index}`, {
          jobId: `job-${index}`,
          status: 'queued',
          createdAt: `2024-01-01T00:00:${String(index).padStart(3, '0')}Z`,
          input: { profileId: null, batchSize: 100 },
        });
      }

      (service as any).trimTrackedJobs();

      expect(jobsMap.size).toBe(200);
      expect(jobsMap.has('job-0')).toBe(false);
      expect(jobsMap.has('job-4')).toBe(false);
      expect(jobsMap.has('job-5')).toBe(true);
    });
  });
});
