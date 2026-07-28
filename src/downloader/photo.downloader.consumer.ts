import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IKafkaConsumerConfig } from 'config/interface';
import { KafkaConsumerService } from 'src/kafka-consumer/kafka-consumer.service';
import { DownloaderService } from './services/downloader.service';

@Injectable()
export class PhotoDownloaderConsumer implements OnModuleInit {
  private config: IKafkaConsumerConfig;
  constructor(
    private readonly consumerService: KafkaConsumerService,
    private configService: ConfigService,
    private downloader: DownloaderService
  ) {
    this.config = this.configService.get('kafka-consumer');
  }

  async onModuleInit() {
    /*await this.consumerService.consume(
     { topics: [this.config.KAFKA_TOPIC], fromBeginning: this.config.KAFKA_FROM_BEGINING },
      {
        autoCommit: this.config.KAFKA_AUTO_COMMIT,
        eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
          await this.downloader.uploadService(
            message.headers,
            Buffer.from(message.key).toString('ascii'),
            Buffer.from(message.value).toString('ascii')
          );
        },
      }
    );*/
  }
}
