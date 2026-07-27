import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadOuletImagesDto {
  @ApiProperty({ description: 'Unique key for the upload batch', example: 'batch123' })
  @IsString()
  key: string;

  @ApiProperty({
    description: 'Array of image file names or URLs',
    example: ['image1.jpg', 'image2.jpg', 'image3.jpg'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  images: string[];
}
