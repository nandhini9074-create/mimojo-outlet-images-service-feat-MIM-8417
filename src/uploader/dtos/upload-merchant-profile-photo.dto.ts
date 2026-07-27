import {
  IsNotEmpty, IsOptional,
} from 'class-validator';

export class UploadMerchantProfileImageDto {
  
 @IsNotEmpty()
 merchantProfileId:string
  @IsOptional()
  setAsHeroImage: boolean;
}