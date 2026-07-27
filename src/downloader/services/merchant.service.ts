import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectModel } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { Merchant } from '../models/merchant.model';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { IBlobConfig } from 'config/interface';
import { Op } from 'sequelize';

@Injectable()
export class MerchantService {
  private readonly blobUrl: string;
  private readonly defaultBatchSize = 100;
  private readonly maxBatchSize = 1000;
  private readonly maxTrackedJobs = 50;
  private readonly migrationJobs = new Map<string, MerchantLogoMigrationJob>();

  constructor(
    @InjectModel(Merchant) private readonly merchantRepository: typeof Merchant,
    private readonly configService: ConfigService,
    private readonly cdnUploadService: CdnUploadService,
    private readonly logger: CustomPinoLogger
  ) {
    const { BLOB_URL } = this.configService.get<IBlobConfig>('blob');
    this.blobUrl = (BLOB_URL || '').toLowerCase();
  }

  startMerchantLogosToCdnMigration(batchSize?: number) {
    const jobId = randomUUID();
    const normalizedBatchSize = this.normalizeBatchSize(batchSize);
    const job: MerchantLogoMigrationJob = {
      jobId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      input: {
        batchSize: normalizedBatchSize,
      },
    };

    this.migrationJobs.set(jobId, job);
    this.trimTrackedJobs();

    void this.runMerchantLogoMigrationJob(jobId, normalizedBatchSize);

    return {
      jobId,
      status: job.status,
      createdAt: job.createdAt,
      input: job.input,
    };
  }

  getMerchantLogosToCdnMigrationStatus(jobId: string) {
    return this.migrationJobs.get(jobId) ?? null;
  }

  private async runMerchantLogoMigrationJob(jobId: string, batchSize?: number): Promise<void> {
    const job = this.migrationJobs.get(jobId);

    if (!job) {
      return;
    }

    job.status = 'running';
    job.startedAt = new Date().toISOString();

    try {
      const summary = await this.performMerchantLogoMigration(batchSize);
      job.status = 'completed';
      job.summary = summary;
      job.finishedAt = new Date().toISOString();
      return;
    } catch (error) {
      job.status = 'failed';
      job.finishedAt = new Date().toISOString();
      job.error = error instanceof Error ? error.message : 'Unknown migration job error';
      this.logger.error('MerchantService.runMerchantLogoMigrationJob failed', {
        jobId,
        error,
      });
    }
  }

  private async performMerchantLogoMigration(batchSize?: number) {
    const normalizedBatchSize = this.normalizeBatchSize(batchSize);
    const summary = {
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      batchSize: normalizedBatchSize,
      invalidBlobUrlMerchantIds: [] as string[],
      failures: [] as Array<{ merchantId: string; reason: string }>,
    };

    let offset = 0;

    while (true) {
      const merchants = await this.merchantRepository.findAll({
        attributes: ['id', 'imageUrl'],
        where: {
          imageUrl: {
            [Op.ne]: null,
          },
        },
        limit: normalizedBatchSize,
        offset,
        order: [['id', 'ASC']],
      });

      if (merchants.length === 0) {
        break;
      }

      summary.total += merchants.length;

      for (const merchant of merchants) {
        await this.processSingleMerchantMigration(merchant, summary);
      }

      offset += merchants.length;
    }

    this.logger.info('MerchantService.migrateMerchantLogosToCdn completed', summary);
    return summary;
  }

  private normalizeBatchSize(batchSize?: number): number {
    const parsedBatchSize = Number(batchSize);
    if (!parsedBatchSize || Number.isNaN(parsedBatchSize) || parsedBatchSize <= 0) {
      return this.defaultBatchSize;
    }

    return Math.min(Math.floor(parsedBatchSize), this.maxBatchSize);
  }

  private async processSingleMerchantMigration(
    merchant: Merchant,
    summary: {
      total: number;
      migrated: number;
      skipped: number;
      failed: number;
      batchSize: number;
      invalidBlobUrlMerchantIds: string[];
      failures: Array<{ merchantId: string; reason: string }>;
    }
  ): Promise<void> {
    const merchantId = merchant.id;
    const imageUrl = merchant.imageUrl;

    if (!imageUrl) {
      summary.skipped += 1;
      return;
    }

    if (!this.isBlobUrl(imageUrl)) {
      summary.skipped += 1;
      summary.invalidBlobUrlMerchantIds.push(merchantId);
      return;
    }

    try {
      const cdnResponse = await this.cdnUploadService.uploadToCdn(imageUrl);
      const parsedResponse = JSON.parse(cdnResponse);
      const cdnUrl = parsedResponse?.result?.variants?.[0];

      if (!cdnUrl) {
        summary.failed += 1;
        summary.failures.push({ merchantId, reason: 'CDN response missing variants[0]' });
        this.logger.warn('MerchantService.migrateMerchantLogosToCdn invalid CDN response', {
          merchantId,
          imageUrl,
          cdnResponse,
        });
        return;
      }

      await merchant.update({ imageUrl: cdnUrl });
      summary.migrated += 1;
    } catch (error) {
      summary.failed += 1;
      const reason = error instanceof Error ? error.message : 'Unknown migration error';
      summary.failures.push({ merchantId, reason });
      this.logger.error('MerchantService.migrateMerchantLogosToCdn failed', {
        merchantId,
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

type MerchantLogoMigrationJobStatus = 'queued' | 'running' | 'completed' | 'failed';

type MerchantLogoMigrationSummary = {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  batchSize: number;
  invalidBlobUrlMerchantIds: string[];
  failures: Array<{ merchantId: string; reason: string }>;
};

type MerchantLogoMigrationJob = {
  jobId: string;
  status: MerchantLogoMigrationJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  input: {
    batchSize: number;
  };
  summary?: MerchantLogoMigrationSummary;
  error?: string;
};
