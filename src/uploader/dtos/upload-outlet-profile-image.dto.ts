import {
  IsNotEmpty, IsOptional,
} from 'class-validator';

export class UploadOutletProfileImageDto {
  
  @IsNotEmpty()
  outletProfileId: string;

  @IsOptional()
  setAsHeroImage: boolean;
}