import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IBlobConfig } from 'config/interface';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { LlmImageOptimizationService } from '../../shared/services/llm-image-optimization.service';

import { randomUUID } from 'crypto';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';

@Injectable()
export class FilesAzureService {
  private containerName: string;
  private connectionString: string;
  private blobUrl: string;
  private blobSasToken: string;
  private readonly serviceName = 'FilesAzureService';
  constructor(
    private readonly configService: ConfigService,
    private readonly cdnUploadService: CdnUploadService,
    private readonly logger: CustomPinoLogger,
    private readonly llmImageOptimizationService: LlmImageOptimizationService
  ) {
    const { BLOB_CONNECTION_STRING, BLOB_CONTAINER_NAME, BLOB_URL, BLOB_SAS_TOKEN } =
      this.configService.get<IBlobConfig>('blob');

    this.containerName = BLOB_CONTAINER_NAME;
    this.connectionString = BLOB_CONNECTION_STRING;
    this.blobUrl = BLOB_URL;
    this.blobSasToken = BLOB_SAS_TOKEN;
  }

  private async getBlobServiceInstance() {
    const blobClientService = BlobServiceClient.fromConnectionString(this.connectionString);
    return blobClientService;
  }

  private async getBlobClient(imageName: string): Promise<BlockBlobClient> {
    const blobService = await this.getBlobServiceInstance();
    const containerName = this.containerName;
    const containerClient = blobService.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(imageName);
    return blockBlobClient;
  }

  public async uploadFile(file: Express.Multer.File, profileId?: string) {
    const methodName = 'uploadFile';
    this.logger.info(`${this.serviceName} - ${methodName} called`, {
      fileName: file.originalname,
      fileSize: file.size,
    });
    try {
      const extension = file.originalname.split('.').pop();
      const file_name = randomUUID() + '.' + extension;

      file.buffer = await this.llmImageOptimizationService.process(file.buffer, profileId);

      const blockBlobClient = await this.getBlobClient(file_name);
      await blockBlobClient.uploadData(file.buffer);

      const cdnResponse = await this.cdnUploadService.uploadToCdn(`${this.blobUrl}/${file_name}?${this.blobSasToken}`);
      await this.deleteBlobFile(file_name);
      return JSON.parse(cdnResponse).result.variants[0];
    } catch (error) {
      this.logger.error(`${this.serviceName} - ${methodName} failed`, { error });
      throw error;
    }
  }

  private async deleteBlobFile(fileName: string): Promise<boolean> {
    const blobClient = await this.getBlobClient(fileName);
    const response = await blobClient.deleteIfExists();
    return response.succeeded;
  }
}
