import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IKafkaConsumerConfig } from 'config/interface';
import { Consumer, ConsumerRunConfig, ConsumerSubscribeTopics, Kafka } from 'kafkajs';

@Injectable()
export class KafkaConsumerService implements OnApplicationShutdown {
    
    private readonly kafka = null;
    private config: IKafkaConsumerConfig;
    
    constructor(private configService: ConfigService) {
        this.config  = this.configService.get("kafka-consumer");
        this.kafka = new Kafka({
            clientId: this.config.KAFKA_CLIENT_ID,
            brokers: this.config.KAFKA_CONSUMER_BROKERS.split(',')
        });
    }
    
    

    private readonly consumers: Consumer[] = [];

    async consume(topic: ConsumerSubscribeTopics, config: ConsumerRunConfig) {
        const consumer = this.kafka.consumer({ groupId: this.config.KAFKA_GROUP_ID })
        //await consumer.connect();
        await consumer.subscribe(topic);
        await consumer.connect();
        await consumer.run(config);
        this.consumers.push(consumer);
    }

    async onApplicationShutdown() {
        for(const consumer of this.consumers)
        {
            await consumer.disconnect();
        }
    }
}

