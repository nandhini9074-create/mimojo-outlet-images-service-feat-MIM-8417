import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { Op } from 'sequelize';
import { IBlobConfig } from 'config/interface';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { MerchantProfileMetadata } from '../models/merchant-profile-metadata.model';

@Injectable()
export class MerchantProfileMetadataService {
  private readonly blobUrl: string;
  private readonly defaultBatchSize = 100;
  private readonly maxBatchSize = 1000;
  private readonly maxTrackedJobs = 200;
  private readonly migrationJobs = new Map<string, MerchantProfileMetadataMigrationJob>();

  constructor(
    @InjectModel(MerchantProfileMetadata)
    private readonly merchantProfileMetadataRepository: typeof MerchantProfileMetadata,
    private readonly configService: ConfigService,
    private readonly cdnUploadService: CdnUploadService,
    private readonly logger: CustomPinoLogger
  ) {
    const { BLOB_URL } = this.configService.get<IBlobConfig>('blob');
    this.blobUrl = (BLOB_URL || '').toLowerCase();
  }

  startMerchantProfileMetadataLogosToCdnMigration(profileId?: string, batchSize?: number) {
    const jobId = randomUUID();
    const normalizedBatchSize = this.normalizeBatchSize(batchSize);
    const job: MerchantProfileMetadataMigrationJob = {
      jobId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      input: {
        profileId: profileId ?? null,
        batchSize: normalizedBatchSize,
      },
    };

    this.migrationJobs.set(jobId, job);
    this.trimTrackedJobs();

    void this.runMerchantProfileMetadataMigrationJob(jobId, profileId, normalizedBatchSize);

    return {
      jobId,
      status: job.status,
      createdAt: job.createdAt,
      input: job.input,
    };
  }

  getMerchantProfileMetadataLogosToCdnMigrationStatus(jobId: string) {
    return this.migrationJobs.get(jobId) ?? null;
  }

  private async runMerchantProfileMetadataMigrationJob(
    jobId: string,
    profileId?: string,
    batchSize?: number
  ): Promise<void> {
    const job = this.migrationJobs.get(jobId);

    if (!job) {
      return;
    }

    job.status = 'running';
    job.startedAt = new Date().toISOString();

    try {
      const summary = await this.migrateMerchantProfileMetadataLogosToCdn(profileId, batchSize);
      job.status = 'completed';
      job.summary = summary;
      job.finishedAt = new Date().toISOString();
      return;
    } catch (error) {
      job.status = 'failed';
      job.finishedAt = new Date().toISOString();
      job.error = error instanceof Error ? error.message : 'Unknown migration job error';
      this.logger.error('MerchantProfileMetadataService.runMerchantProfileMetadataMigrationJob failed', {
        jobId,
        profileId,
        error,
      });
    }
  }

  private async migrateMerchantProfileMetadataLogosToCdn(profileId?: string, batchSize?: number) {
    const normalizedBatchSize = this.normalizeBatchSize(batchSize);
    const whereClause: Record<string, unknown> = {
      imageUrl: {
        [Op.ne]: null,
      },
    };

    if (profileId) {
      whereClause.profileId = profileId;
    }

    const summary = {
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      batchSize: normalizedBatchSize,
      profileId: profileId ?? null,
      invalidBlobUrlMerchantProfileMetadataIds: [] as string[],
      failures: [] as Array<{ merchantProfileMetadataId: string; profileId: string; reason: string }>,
    };

    let offset = 0;

    while (true) {
      const merchantProfiles = await this.merchantProfileMetadataRepository.findAll({
        attributes: ['id', 'profileId', 'imageUrl'],
        where: whereClause,
        limit: normalizedBatchSize,
        offset,
        order: [['id', 'ASC']],
      });

      if (merchantProfiles.length === 0) {
        break;
      }

      summary.total += merchantProfiles.length;

      for (const merchantProfile of merchantProfiles) {
        await this.processSingleMerchantProfileMigration(merchantProfile, summary);
      }

      offset += merchantProfiles.length;
    }

    this.logger.info('MerchantProfileMetadataService.migrateMerchantProfileMetadataLogosToCdn completed', summary);
    return summary;
  }

  private normalizeBatchSize(batchSize?: number): number {
    const parsedBatchSize = Number(batchSize);
    if (!parsedBatchSize || Number.isNaN(parsedBatchSize) || parsedBatchSize <= 0) {
      return this.defaultBatchSize;
    }

    return Math.min(Math.floor(parsedBatchSize), this.maxBatchSize);
  }

  private async processSingleMerchantProfileMigration(
    merchantProfile: MerchantProfileMetadata,
    summary: {
      total: number;
      migrated: number;
      skipped: number;
      failed: number;
      batchSize: number;
      profileId: string | null;
      invalidBlobUrlMerchantProfileMetadataIds: string[];
      failures: Array<{ merchantProfileMetadataId: string; profileId: string; reason: string }>;
    }
  ): Promise<void> {
    const merchantProfileMetadataId = merchantProfile.id;
    const merchantProfileId = merchantProfile.profileId;
    const imageUrl = merchantProfile.imageUrl;

    if (!imageUrl) {
      summary.skipped += 1;
      return;
    }

    if (!this.isBlobUrl(imageUrl)) {
      summary.skipped += 1;
      summary.invalidBlobUrlMerchantProfileMetadataIds.push(merchantProfileMetadataId);
      return;
    }

    try {
      const cdnResponse = await this.cdnUploadService.uploadToCdn(imageUrl);
      const parsedResponse = JSON.parse(cdnResponse);
      const cdnUrl = parsedResponse?.result?.variants?.[0];

      if (!cdnUrl) {
        summary.failed += 1;
        summary.failures.push({
          merchantProfileMetadataId,
          profileId: merchantProfileId,
          reason: 'CDN response missing variants[0]',
        });
        this.logger.warn('MerchantProfileMetadataService.migrateMerchantProfileMetadataLogosToCdn invalid CDN response', {
          merchantProfileMetadataId,
          profileId: merchantProfileId,
          imageUrl,
          cdnResponse,
        });
        return;
      }

      await merchantProfile.update({ imageUrl: cdnUrl });
      summary.migrated += 1;
    } catch (error) {
      summary.failed += 1;
      const reason = error instanceof Error ? error.message : 'Unknown migration error';
      summary.failures.push({
        merchantProfileMetadataId,
        profileId: merchantProfileId,
        reason,
      });
      this.logger.error('MerchantProfileMetadataService.migrateMerchantProfileMetadataLogosToCdn failed', {
        merchantProfileMetadataId,
        profileId: merchantProfileId,
        imageUrl,
        error,
      });
    }
  }

  private isBlobUrl(url: string): boolean {
    if (!url) {
      return false;
    }

    const normalizedUrl = url.toLowerCase();
    return this.blobUrl ? normalizedUrl.startsWith(this.blobUrl) : normalizedUrl.includes('.blob.core.windows.net');
  }

  private trimTrackedJobs(): void {
    if (this.migrationJobs.size <= this.maxTrackedJobs) {
      return;
    }

    const sortedByCreatedAt = Array.from(this.migrationJobs.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const overflowCount = this.migrationJobs.size - this.maxTrackedJobs;
    for (let index = 0; index < overflowCount; index += 1) {
      this.migrationJobs.delete(sortedByCreatedAt[index].jobId);
    }
  }
}

type MerchantProfileMetadataMigrationJobStatus = 'queued' | 'running' | 'completed' | 'failed';

type MerchantProfileMetadataMigrationSummary = {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  batchSize: number;
  profileId: string | null;
  invalidBlobUrlMerchantProfileMetadataIds: string[];
  failures: Array<{ merchantProfileMetadataId: string; profileId: string; reason: string }>;
};

type MerchantProfileMetadataMigrationJob = {
  jobId: string;
  status: MerchantProfileMetadataMigrationJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  input: {
    profileId: string | null;
    batchSize: number;
  };
  summary?: MerchantProfileMetadataMigrationSummary;
  error?: string;
};
