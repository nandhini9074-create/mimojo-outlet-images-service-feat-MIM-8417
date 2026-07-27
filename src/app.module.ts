import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  appConfig,
  blobConfig,
  cdnConfig,
  databaseConfig,
  grafanaCredentials,
  googleConfig,
  kafkaConsumerConfig,
} from '../config/server.config';
import { validate } from 'env.validation';
import { SequelizeModule } from '@nestjs/sequelize';
import { databaseBuilder } from './helpers/database';
import { DownloaderModule } from './downloader/downloader.module';
import { UploaderModule } from './uploader/uploader.module';
import { AppController } from './app.controller';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/errors/catch-all-errors';
import { FileModule } from './files/file.module';
import { LoggerModule, PinoLogger } from 'nestjs-pino';
import { PINO_LOGGER_OPTIONS_TOKEN, PinoLoggerInterceptor } from './logger/logger.interceptor';
import { CustomLoggerModule } from './logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig, databaseConfig, kafkaConsumerConfig, googleConfig, blobConfig, cdnConfig, grafanaCredentials],
      cache: true,
      isGlobal: true,
      validate,
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return databaseBuilder(config);
      },
    }),
    DownloaderModule,
    UploaderModule,
    FileModule,
    LoggerModule.forRoot(),
    CustomLoggerModule,
  ],
  providers: [
    AppService,
    PinoLogger,
    {
      provide: PINO_LOGGER_OPTIONS_TOKEN,
      useValue: {
        logRequests: true,
        logResponseBody: true,
      },
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PinoLoggerInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  controllers: [AppController],
})
export class AppModule {}
