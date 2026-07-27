import {
  IsNotEmpty, IsOptional,
} from 'class-validator';

export class UploadMerchantImageDto {
  
 @IsNotEmpty()
 merchantId:string
  @IsOptional()
  setAsHeroImage: boolean;
}