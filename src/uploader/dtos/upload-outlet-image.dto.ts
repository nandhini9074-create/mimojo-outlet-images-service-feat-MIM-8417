import { IsBoolean, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadOuletImageDto {
  @ApiProperty({ description: 'Outlet UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  outletId: string;

  @ApiProperty({ description: 'Name of the image file', example: 'outlet-front.jpg' })
  @IsString()
  imageName: string;

  @ApiProperty({ description: 'Whether this image is the default for the outlet', example: true })
  @IsBoolean()
  isDefault: boolean;
}
