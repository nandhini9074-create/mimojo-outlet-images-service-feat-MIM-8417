import { registerAs } from '@nestjs/config';
import { EnvironmentEnum } from 'env.validation';
import { EnvKeysEnum } from './env.enum';
import {
  IAppConfig,
  IBlobConfig,
  ICdnConfig,
  ICredentialsConfig,
  IDatabaseConfig,
  IGoogleConfig,
  IKafkaConsumerConfig,
  IGrafanaConfig,
  ILLMConfig,
} from './interface';
import { Dialect } from 'sequelize/types';

export const appConfig = registerAs(
  'app',
  (): IAppConfig => ({
    NODE_ENV: process.env[EnvKeysEnum.NODE_ENV] as EnvironmentEnum,
    SERVER_HTTP_PORT: parseInt(process.env[EnvKeysEnum.SERVER_HTTP_PORT], 10),
    SERVER_HTTP_HOST: process.env[EnvKeysEnum.SERVER_HTTP_HOST],
    IS_SWAGGER_ENABLED: JSON.parse(process.env[EnvKeysEnum.IS_SWAGGER_ENABLED]),
    DOMAIN_URL: process.env[EnvKeysEnum.DOMAIN_URL],
    AUDIT_LOG_NODE_HERO_IMAGE: process.env[EnvKeysEnum.AUDIT_LOG_NODE_HERO_IMAGE] as string,
  })
);

export const credentialsConfig = registerAs('credentials', (): ICredentialsConfig => ({}));

export const databaseConfig = registerAs(
  'database',
  (): IDatabaseConfig => ({
    DB_DIALECT: process.env[EnvKeysEnum.DB_DIALECT] as Dialect,
    DB_PORT: parseInt(process.env[EnvKeysEnum.DB_PORT]),
    DB_DATABASE: process.env[EnvKeysEnum.DB_DATABASE],
    DB_HOST: process.env[EnvKeysEnum.DB_HOST],
    DB_USERNAME: process.env[EnvKeysEnum.DB_USERNAME],
    DB_PASSWORD: process.env[EnvKeysEnum.DB_PASSWORD] as string,
    DB_AUTO_LOAD_MODELS: JSON.parse(process.env[EnvKeysEnum.DB_AUTO_LOAD_MODELS]),
    DB_SYNC: JSON.parse(process.env[EnvKeysEnum.DB_SYNC]),
    DB_FORCE: JSON.parse(process.env[EnvKeysEnum.DB_FORCE]),
    DB_POOL_MIN: parseInt(process.env[EnvKeysEnum.DB_POOL_MIN]),
    DB_POOL_MAX: parseInt(process.env[EnvKeysEnum.DB_POOL_MAX]),
    DB_LOGGING: JSON.parse(process.env[EnvKeysEnum.DB_LOGGING]),
    DB_UNDERSCORED: JSON.parse(process.env[EnvKeysEnum.DB_UNDERSCORED]),
  })
);

export const kafkaConsumerConfig = registerAs(
  'kafka-consumer',
  (): IKafkaConsumerConfig => ({
    KAFKA_ALLOW_AUTO_TOPIC_CREATION: JSON.parse(process.env[EnvKeysEnum.KAFKA_ALLOW_AUTO_TOPIC_CREATION]),
    KAFKA_AUTO_COMMIT: JSON.parse(process.env[EnvKeysEnum.KAFKA_AUTO_COMMIT]),
    KAFKA_PRODUCER_BROKERS: process.env[EnvKeysEnum.KAFKA_PRODUCER_BROKERS] as string,
    KAFKA_CONSUMER_BROKERS: process.env[EnvKeysEnum.KAFKA_CONSUMER_BROKERS] as string,
    KAFKA_CLIENT_ID: process.env[EnvKeysEnum.KAFKA_CLIENT_ID],
    KAFKA_FROM_BEGINING: JSON.parse(process.env[EnvKeysEnum.KAFKA_FROM_BEGINING]),
    KAFKA_GROUP_ID: process.env[EnvKeysEnum.KAFKA_GROUP_ID],
    KAFKA_TOPIC: process.env[EnvKeysEnum.KAFKA_TOPIC],
    KAFKA_AUDIT_LOG_TOPIC: process.env[EnvKeysEnum.KAFKA_AUDIT_LOG_TOPIC],
  })
);

export const googleConfig = registerAs(
  'google',
  (): IGoogleConfig => ({
    GOOGLE_KEY: process.env[EnvKeysEnum.GOOGLE_KEY] as string,
  })
);

export const blobConfig = registerAs(
  'blob',
  (): IBlobConfig => ({
    BLOB_URL: process.env[EnvKeysEnum.BLOB_URL] as string,
    BLOB_SAS_TOKEN: process.env[EnvKeysEnum.BLOB_SAS_TOKEN] as string,
    BLOB_CONNECTION_STRING: process.env[EnvKeysEnum.BLOB_CONNECTION_STRING] as string,
    BLOB_CONTAINER_NAME: process.env[EnvKeysEnum.BLOB_CONTAINER_NAME] as string,
  })
);

export const cdnConfig = registerAs(
  'cdn',
  (): ICdnConfig => ({
    CDN_LINK: process.env[EnvKeysEnum.CDN_LINK] as string,
    CDN_AUTHORIZATION: process.env[EnvKeysEnum.CDN_AUTHORIZATION] as string,
  })
);

export const grafanaCredentials = registerAs(
  'grafanaCredentials',
  (): IGrafanaConfig => ({
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env[EnvKeysEnum.OTEL_EXPORTER_OTLP_ENDPOINT] ?? '',
    SERVICE_NAME: process.env[EnvKeysEnum.SERVICE_NAME] ?? '',
  })
);

export const llmConfig = registerAs(
  'llm',
  (): ILLMConfig => ({
    GEMINI_API_KEY: process.env[EnvKeysEnum.GEMINI_API_KEY] as string,
  })
);
