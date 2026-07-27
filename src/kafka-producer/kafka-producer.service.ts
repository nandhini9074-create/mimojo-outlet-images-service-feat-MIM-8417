import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IKafkaConsumerConfig } from 'config/interface';
import { Producer, Kafka, ProducerRecord } from 'kafkajs';

@Injectable()
export class KafkaProducerService {
  private readonly kafka = null;
  private config: IKafkaConsumerConfig;
  private readonly producer: Producer = null;

  constructor(private configService: ConfigService) {
    this.config = this.configService.get('kafka-consumer');
    this.kafka = new Kafka({
      clientId: this.config.KAFKA_CLIENT_ID,
      brokers: this.config.KAFKA_PRODUCER_BROKERS.split(','),
    });
    this.producer = this.kafka.producer();
    this.producer.connect();
    console.log('Kafka initialized...');
  }

  async produce(record: ProducerRecord) {
    this.producer.send(record);
  }

  async onApplicationShutdown() {
    await this.producer.disconnect();
  }
}
