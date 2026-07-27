import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IKafkaConsumerConfig } from 'config/interface';
import { KafkaProducerService } from '../kafka-producer/kafka-producer.service';

@Injectable()
export class DataOperationsProducer {
  private config: IKafkaConsumerConfig;

  constructor(
    private readonly producerService: KafkaProducerService,
    private configService: ConfigService
  ) {
    this.config = this.configService.get('kafka-consumer');
  }

  async pushToAuditLogService(
    transReference: string,
    notification: Record<string, unknown>,
    headers: Record<string, string | Buffer | undefined>
  ) {
    if (notification) {
      await this.producerService.produce({
        topic: this.config.KAFKA_AUDIT_LOG_TOPIC,
        messages: [
          {
            key: transReference,
            value: JSON.stringify(notification),
            headers,
          },
        ],
      });
    }
  }
}
