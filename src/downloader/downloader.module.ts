import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { googleConfig, kafkaConsumerConfig } from 'config/server.config';
import { KafkaConsumerService } from 'src/kafka-consumer/kafka-consumer.service';
import { DownloaderService } from './services/downloader.service';
import { OutletPhoto } from './models/outlet-photo.model';
import { PhotoDownloaderConsumer } from './photo.downloader.consumer';
import { OutletPhotoService } from './services/outlet-photo.service';
import { MerchantProfilePhoto } from './models/merchant-profile-photo.entity';
import { MerchantProfilePhotoService } from './services/merchant-profile-photo.service';
import { MerchantPhotoService } from './services/merchant-photo.service';
import { MerchantPhoto } from './models/merchant-photo.model';
import { OutletProfilePhotoService } from './services/outlet-profile-photos.service';
import { OutletProfilePhotos } from './models/outlet-profile-photos';
import { MerchantProfileMetadata } from './models/merchant-profile-metadata.model';
import { OutletProfileMetadata } from './models/outlet-profile.model';
import { CustomLoggerModule } from 'src/logger/logger.module';
import { OutletProfileMetadataService } from './services/outlet-profile-metadata.service';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { HttpModule } from 'src/shared/module/httpModule.module';
import { MerchantService } from './services/merchant.service';
import { Merchant } from './models/merchant.model';
import { MerchantProfileMetadataService } from './services/merchant-profile-metadata.service';
import { DataOperationsProducer } from 'src/kafka-service/data-operations.producer';
import { KafkaProducerService } from 'src/kafka-producer/kafka-producer.service';

@Module({
  providers: [
    DownloaderService,
    KafkaConsumerService,
    KafkaProducerService,
    PhotoDownloaderConsumer,
    OutletPhotoService,
    MerchantProfilePhotoService,
    MerchantPhotoService,
    OutletProfilePhotoService,
    OutletProfileMetadataService,
    CdnUploadService,
    MerchantService,
    MerchantProfileMetadataService,
    DataOperationsProducer,
  ],
  imports: [
    ConfigModule.forRoot({
      load: [kafkaConsumerConfig, googleConfig],
      cache: true,
      isGlobal: true,
    }),
    SequelizeModule.forFeature([
      OutletPhoto,
      MerchantProfilePhoto,
      MerchantPhoto,
      Merchant,
      OutletProfilePhotos,
      MerchantProfileMetadata,
      OutletProfileMetadata,
    ]),
    CustomLoggerModule,
    HttpModule,
  ],
  exports: [
    OutletPhotoService,
    DownloaderService,
    MerchantProfilePhotoService,
    MerchantPhotoService,
    MerchantService,
    MerchantProfileMetadataService,
    OutletProfilePhotoService,
    OutletProfileMetadataService,
  ],
})
export class DownloaderModule {}
