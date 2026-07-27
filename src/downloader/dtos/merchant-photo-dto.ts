import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateMerchantHeroImageDto {
  @IsNotEmpty()
  merchantId: string;

  @IsOptional()
  @IsBoolean()
  setAsHeroImage: boolean;

  @IsNotEmpty()
  newHeroImageId: string;

  @IsOptional()
  existingHeroImageId: string;

  @IsOptional()
  profileId: string;
}
