import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { baseResponseHelper } from 'helper/base-response.helper';
import { ApiEndpoint } from 'src/common/decorators/api-swagger';
import { UpdateMerchantHeroImageDto } from 'src/downloader/dtos/merchant-photo-dto';
import { DownloaderService } from 'src/downloader/services/downloader.service';
import { MerchantProfileMetadataService } from 'src/downloader/services/merchant-profile-metadata.service';
import { MerchantService } from 'src/downloader/services/merchant.service';
import {
  UploadMerchantImageFileDto,
  UploadMerchantProfileImageFileDto,
  UploadOutletProfileImageFileDto,
} from './dtos/swagger/file-upload-example.dto';
import { UploadMerchantProfileImageDto } from './dtos/upload-merchant-profile-photo.dto';
import { UploadMerchantImageDto } from './dtos/upload-merchant.dto';
import { UploadOuletImageDto } from './dtos/upload-outlet-image.dto';
import { UploadOuletImagesDto } from './dtos/upload-outlet-images.dto';
import { UploadOutletProfileImageDto } from './dtos/upload-outlet-profile-image.dto';
export const imageFileFilter = (req, file, callback) => {
  if (!file.mimetype?.startsWith('image/')) {
    return callback(new BadRequestException('Only image files are allowed!'), false);
  }
  callback(null, true);
};
@Controller({ path: 'uploader' })
export class UploaderController {
  constructor(
    private readonly downloaderService: DownloaderService,
    private readonly merchantService: MerchantService,
    private readonly merchantProfileMetadataService: MerchantProfileMetadataService
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('upload-outlet-image')
  @ApiEndpoint({
    summary: 'Upload outlet image',
    description: 'Uploads an image for a specific outlet',
    bodyType: UploadOuletImageDto,
  })
  async UploadOutletImage(@Body() model: UploadOuletImageDto): Promise<any> {
    return baseResponseHelper(await this.downloaderService.uploadImagesSync(model));
  }

  @Post('upload-merchant-profile-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  @ApiEndpoint({
    summary: 'Upload merchant profile image',
    description: 'Uploads a profile image for a specific merchant',
    bodyType: UploadMerchantProfileImageFileDto,
  })
  async uploadMerchantProfileImage(@UploadedFile() image: Express.Multer.File, @Body() dto: UploadMerchantProfileImageDto) {
    const response = await this.downloaderService.uploadMerchantProfileImage(dto, image);
    return baseResponseHelper(response);
  }

  @Post('upload-merchant-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  @ApiEndpoint({
    summary: 'Upload merchant image',
    description: 'Uploads an image for a specific merchant',
    bodyType: UploadMerchantImageFileDto,
  })
  async uploadMerchantImage(@UploadedFile() image: Express.Multer.File, @Body() dto: UploadMerchantImageDto) {
    const response = await this.downloaderService.uploadMerchantImage(dto, image);
    return baseResponseHelper(response);
  }

  @Post('upload-outlet-profile-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: imageFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  @ApiEndpoint({
    summary: 'Upload outlet profile image',
    description: 'Uploads a profile image for a specific outlet',
    bodyType: UploadOutletProfileImageFileDto,
  })
  async uploadOutletProfileImage(@UploadedFile() image: Express.Multer.File, @Body() dto: UploadOutletProfileImageDto) {
    const response = await this.downloaderService.uploadOutletProfileImage(dto, image);
    return baseResponseHelper(response);
  }

  @HttpCode(HttpStatus.OK)
  @Post('upload-outlet-images-manual')
  @ApiEndpoint({
    summary: 'Upload outlet images manually',
    description: 'Uploads multiple images for a specific outlet using provided keys',
    bodyType: UploadOuletImagesDto,
  })
  async UploadOutletImageManual(@Body() model: UploadOuletImagesDto): Promise<any> {
    return baseResponseHelper(await this.downloaderService.uploadPoiImages(model.key, model.images));
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-merchant-hero-image')
  @ApiEndpoint({
    summary: 'Mark merchant hero image',
    description: 'Marks an image as the hero image for a specific merchant',
    bodyType: UploadMerchantImageFileDto,
  })
  async markMerchantHeroImage(@Body() dto: UpdateMerchantHeroImageDto) {
    const response = await this.downloaderService.markMerchantHeroImage(dto);
    return baseResponseHelper(response);
  }

  @HttpCode(HttpStatus.OK)
  @Post('migrate-merchant-logo-to-cdn')
  @ApiEndpoint({
    summary: 'Start merchant logo migration',
    description: 'Starts a background job to migrate merchant logos from blob to CDN.',
  })
  startMigrateMerchantLogosToCdn(@Body('batchSize') batchSize?: number) {
    const response = this.merchantService.startMerchantLogosToCdnMigration(batchSize);
    return baseResponseHelper(response);
  }

  @HttpCode(HttpStatus.OK)
  @Get('migrate-merchant-logo-to-cdn/status/:jobId')
  @ApiEndpoint({
    summary: 'Get merchant logo migration status',
    description: 'Returns current status and summary for a background merchant logo migration job.',
  })
  getMigrateMerchantLogosToCdnStatus(@Param('jobId') jobId: string) {
    const response = this.merchantService.getMerchantLogosToCdnMigrationStatus(jobId);
    if (!response) {
      throw new NotFoundException(`Migration job not found for jobId: ${jobId}`);
    }

    return baseResponseHelper(response);
  }

  @HttpCode(HttpStatus.OK)
  @Post('migrate-merchant-profile-logo-to-cdn')
  @ApiEndpoint({
    summary: 'Migrate merchant profile logos to CDN',
    description:
      'Starts a background job to migrate merchant profile metadata logos from blob to CDN. Optionally filter by profileId.',
  })
  async migrateMerchantProfileMetadataLogosToCdn(
    @Body('profileId') profileId?: string,
    @Body('batchSize') batchSize?: number
  ) {
    const response = this.merchantProfileMetadataService.startMerchantProfileMetadataLogosToCdnMigration(
      profileId,
      batchSize
    );
    return baseResponseHelper(response);
  }

  @HttpCode(HttpStatus.OK)
  @Get('migrate-merchant-profile-logo-to-cdn/status/:jobId')
  @ApiEndpoint({
    summary: 'Get merchant profile logo migration status',
    description: 'Returns current status and summary for a background merchant profile logo migration job.',
  })
  getMigrateMerchantProfileMetadataLogosToCdnStatus(@Param('jobId') jobId: string) {
    const response = this.merchantProfileMetadataService.getMerchantProfileMetadataLogosToCdnMigrationStatus(jobId);
    if (!response) {
      throw new NotFoundException(`Migration job not found for jobId: ${jobId}`);
    }

    return baseResponseHelper(response);
  }
}
