import { ConfigService } from '@nestjs/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { FilesAzureService } from '../file.service';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';

jest.mock('@azure/storage-blob');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

describe('FilesAzureService', () => {
  let service: FilesAzureService;
  let mockConfigService: Partial<ConfigService>;
  let mockCdnUploadService: { uploadToCdn: jest.Mock };
  let mockLogger: { info: jest.Mock; error: jest.Mock };

  const mockUploadUrl = 'https://dummy.blob.core.windows.net/container/mock-uuid.png';
  const mockCdnUrl = 'https://cdn.example.com/mock-uuid.png';

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'blob') {
          return {
            BLOB_CONNECTION_STRING: 'mock-connection-string',
            BLOB_CONTAINER_NAME: 'mock-container',
            BLOB_URL: 'https://dummy.blob.core.windows.net/container',
            BLOB_SAS_TOKEN: 'mock-sas-token',
          };
        }

        if (key === 'cdn') {
          return {
            CDN_LINK: 'https://api.cdn.example.com/upload',
            CDN_AUTHORIZATION: 'Authorization: Bearer token',
          };
        }

        return null;
      }),
    };

    mockCdnUploadService = {
      uploadToCdn: jest.fn().mockResolvedValue(JSON.stringify({ result: { variants: [mockCdnUrl] } })),
    };

    const mockLlmImageOptimizationService = {
      process: jest.fn().mockImplementation((buf) => Promise.resolve(buf)),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    service = new FilesAzureService(
      mockConfigService as ConfigService,
      mockCdnUploadService as unknown as CdnUploadService,
      mockLogger as any,
      mockLlmImageOptimizationService as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should upload a file and return CDN URL', async () => {
    const mockFile = {
      originalname: 'test.png',
      buffer: Buffer.from('file-buffer'),
    } as Express.Multer.File;

    const mockBlockBlobClient = {
      url: mockUploadUrl,
      uploadData: jest.fn().mockResolvedValue(undefined),
      deleteIfExists: jest.fn().mockResolvedValue({ succeeded: true }),
    };

    const mockContainerClient = {
      getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
    };

    const mockBlobServiceClient = {
      getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
    };

    (BlobServiceClient.fromConnectionString as jest.Mock).mockReturnValue(mockBlobServiceClient);
    const result = await service.uploadFile(mockFile);

    expect(BlobServiceClient.fromConnectionString).toHaveBeenCalledWith('mock-connection-string');
    expect(mockBlobServiceClient.getContainerClient).toHaveBeenCalledWith('mock-container');
    expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('mock-uuid.png');
    expect(mockBlockBlobClient.uploadData).toHaveBeenCalledWith(mockFile.buffer);
    expect(mockCdnUploadService.uploadToCdn).toHaveBeenCalledWith(`${mockUploadUrl}?mock-sas-token`);
    expect(mockBlockBlobClient.deleteIfExists).toHaveBeenCalled();
    expect(result).toBe(mockCdnUrl);
  });
});
