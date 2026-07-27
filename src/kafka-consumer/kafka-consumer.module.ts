import { Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka-consumer.service';
import { KafkaProducerService } from 'src/kafka-producer/kafka-producer.service';

@Module({
  providers: [KafkaConsumerService, KafkaProducerService],
})
export class KafkaConsumerModule {}
