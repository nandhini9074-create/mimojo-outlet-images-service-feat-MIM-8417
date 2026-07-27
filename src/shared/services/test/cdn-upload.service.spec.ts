import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { CdnUploadService } from '../cdn-upload.service';

describe('CdnUploadService', () => {
  let service: CdnUploadService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockHttpService: { axiosRef: { post: jest.Mock } };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue({
        CDN_LINK: 'https://cdn.example.com/upload',
        CDN_AUTHORIZATION: 'Authorization: Bearer token-123',
      }),
    } as unknown as jest.Mocked<ConfigService>;

    mockHttpService = {
      axiosRef: {
        post: jest.fn(),
      },
    };

    service = new CdnUploadService(mockConfigService, mockHttpService as unknown as HttpService);
  });

  it('uploads to CDN and returns string response', async () => {
    mockHttpService.axiosRef.post.mockResolvedValue({ data: 'ok' });

    const result = await service.uploadToCdn('https://blob.example.com/container/file.jpg?sig=abc123');

    expect(result).toBe('ok');
    expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
      'https://cdn.example.com/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-123' },
        timeout: 15000,
      })
    );
  });

  it('uploads to CDN and returns JSON-stringified response when response data is object', async () => {
    mockHttpService.axiosRef.post.mockResolvedValue({ data: { result: { variants: ['https://cdn.example.com/img.jpg'] } } });

    const result = await service.uploadToCdn('https://blob.example.com/container/file.jpg?sig=abc123');

    expect(result).toBe(JSON.stringify({ result: { variants: ['https://cdn.example.com/img.jpg'] } }));
  });

  it('maps 403 responses to a detailed error', async () => {
    const axiosError = {
      response: {
        status: 403,
        data: '<Error><Code>AuthenticationFailed</Code></Error>',
      },
    } as AxiosError;

    mockHttpService.axiosRef.post.mockRejectedValue(axiosError);

    await expect(service.uploadToCdn('https://blob.example.com/container/file.jpg?sig=abc123')).rejects.toThrow(
      'CDN upload rejected with 403'
    );
  });

  it('rethrows non-403 errors', async () => {
    const networkError = new Error('socket hang up');
    mockHttpService.axiosRef.post.mockRejectedValue(networkError);

    await expect(service.uploadToCdn('https://blob.example.com/container/file.jpg?sig=abc123')).rejects.toThrow(
      'socket hang up'
    );
  });

  it('validateAndSanitizeUrl keeps https URL and strips query string', () => {
    const result = (service as any).validateAndSanitizeUrl('https://blob.example.com/container/file.jpg?sig=abc123');
    expect(result).toBe('https://blob.example.com/container/file.jpg');
  });

  it('validateAndSanitizeUrl rejects non-https URL', () => {
    expect(() => (service as any).validateAndSanitizeUrl('http://blob.example.com/container/file.jpg')).toThrow(
      'Invalid blobUrl: Must start with "https://"'
    );
  });

  it('validateAndSanitizeUrl rejects very long URL', () => {
    const longUrl = `https://blob.example.com/${'a'.repeat(5000)}`;
    expect(() => (service as any).validateAndSanitizeUrl(longUrl)).toThrow(
      'Invalid blobUrl: Must less than 5000 characters'
    );
  });

  it('parseHeaderValue supports raw Authorization token value', () => {
    const result = (service as any).parseHeaderValue('Bearer token-456');
    expect(result).toEqual({ Authorization: 'Bearer token-456' });
  });
});
