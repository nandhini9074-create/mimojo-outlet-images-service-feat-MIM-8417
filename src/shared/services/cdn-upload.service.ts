import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ICdnConfig } from 'config/interface';
import { AxiosError } from 'axios';

@Injectable()
export class CdnUploadService {
  private readonly cdnLink: string;
  private readonly cdnAuthorization: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    const { CDN_LINK, CDN_AUTHORIZATION } = this.configService.get<ICdnConfig>('cdn');
    this.cdnLink = CDN_LINK;
    this.cdnAuthorization = CDN_AUTHORIZATION;
  }

  async uploadToCdn(blobUrl: string): Promise<string> {
    const validatedUrl = this.validateAndSanitizeUrl(blobUrl);
    const formData = new FormData();
    formData.append('url', validatedUrl);

    try {
      const response = await this.httpService.axiosRef.post(this.cdnLink, formData, {
        headers: {
          ...this.parseHeaderValue(this.cdnAuthorization),
        },
        timeout: 15000,
      });

      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const responseData = this.toMessage(axiosError.response?.data);
      if (status === 403) {
        throw new Error(
          `CDN upload rejected with 403. Verify CDN_AUTHORIZATION and Blob SAS permissions/expiry. Blob URL host: ${new URL(validatedUrl).host}. CDN response: ${responseData}`
        );
      }
      throw error;
    }
  }

  private validateAndSanitizeUrl(blobUrl: string): string {
    if (!blobUrl.startsWith('https://')) {
      throw new Error('Invalid blobUrl: Must start with "https://"');
    }
    if (blobUrl.length > 5000) {
      throw new Error('Invalid blobUrl: Must less than 5000 characters');
    }

    // Example sanitization: Remove any special characters or additional parameters from the URL
    const sanitizedUrl = blobUrl.replace(/\?.*$/, '');

    return sanitizedUrl;
  }

  private parseHeaderValue(headerLine: string): Record<string, string> {
    const normalizedHeaderLine = headerLine.replace(/^\uFEFF/, '').trim();
    const separatorIndex = normalizedHeaderLine.indexOf(':');
    if (separatorIndex < 0) {
      return { Authorization: normalizedHeaderLine };
    }
    if (separatorIndex <= 0 || separatorIndex === headerLine.length - 1) {
      throw new Error('Invalid CDN authorization header format');
    }

    const key = normalizedHeaderLine.slice(0, separatorIndex).trim();
    const value = normalizedHeaderLine.slice(separatorIndex + 1).trim();
    return { [key]: value };
  }

  private toMessage(data: unknown): string {
    if (typeof data === 'string') {
      return data.slice(0, 300);
    }
    try {
      return JSON.stringify(data).slice(0, 300);
    } catch {
      return 'Unable to parse response body';
    }
  }
}
