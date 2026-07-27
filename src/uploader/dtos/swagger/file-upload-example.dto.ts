import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class UploadMerchantProfileImageFileDto {
  @ApiPropertyOptional({
    type: 'string',
    maxLength: 200,
    description: 'Optional merchantProfileId ID',
  })
  @IsNotEmpty()
  merchantProfileId: string;

  @ApiPropertyOptional({
    type: 'boolean',
    description: 'Whether to set the image as the hero image',
  })
  @IsOptional()
  setAsHeroImage: boolean;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional outlet image files',
  })
  image?: any;
}

export class UploadMerchantImageFileDto {
  @ApiPropertyOptional({
    type: 'string',
    maxLength: 200,
    description: 'Optional merchantId ID',
  })
  @IsNotEmpty()
  merchantId: string;

  @ApiPropertyOptional({
    type: 'boolean',
    description: 'Whether to set the image as the hero image',
  })
  @IsOptional()
  setAsHeroImage: boolean;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional outlet image files',
  })
  image?: any;
}

export class UploadOutletProfileImageFileDto {
  @ApiPropertyOptional({
    type: 'string',
    maxLength: 200,
    description: 'Optional outletProfileId ID',
  })
  @IsNotEmpty()
  outletProfileId: string;

  @ApiPropertyOptional({
    type: 'boolean',
    description: 'Whether to set the image as the hero image',
  })
  @IsOptional()
  setAsHeroImage: boolean;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional outlet image files',
  })
  image?: any;
}
