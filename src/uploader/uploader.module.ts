import { Module } from '@nestjs/common';
import { UploaderController } from './uploader.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { OutletPhoto } from 'src/downloader/models/outlet-photo.model';
import { OutletPhotoService } from 'src/downloader/services/outlet-photo.service';
import { DownloaderModule } from 'src/downloader/downloader.module';
import { CustomLoggerModule } from 'src/logger/logger.module';
import { MerchantProfileMetadata } from 'src/downloader/models/merchant-profile-metadata.model';
import { OutletProfileMetadata } from 'src/downloader/models/outlet-profile.model';

@Module({
  controllers: [UploaderController],
  providers: [OutletPhotoService],
  imports: [
    SequelizeModule.forFeature([OutletPhoto, MerchantProfileMetadata, OutletProfileMetadata]),
    DownloaderModule,
    CustomLoggerModule,
  ],
})
export class UploaderModule {}
