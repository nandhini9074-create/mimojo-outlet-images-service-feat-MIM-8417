import { EnvironmentEnum } from 'env.validation';
import { Dialect } from 'sequelize/types';

export interface IAppConfig {
  SERVER_HTTP_HOST: string;
  SERVER_HTTP_PORT: number;
  NODE_ENV: EnvironmentEnum;
  IS_SWAGGER_ENABLED: boolean;
  DOMAIN_URL: string;
  AUDIT_LOG_NODE_HERO_IMAGE: string;
}

export interface ICredentialsConfig {}

export interface IDatabaseConfig {
  DB_DIALECT: Dialect;
  DB_PORT: number;
  DB_DATABASE: string;
  DB_AUTO_LOAD_MODELS: boolean;
  DB_SYNC: boolean;
  DB_FORCE: boolean;
  DB_POOL_MIN: number;
  DB_POOL_MAX: number;
  DB_LOGGING: boolean;
  DB_UNDERSCORED: boolean;
  DB_HOST: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
}

export interface IKafkaConsumerConfig {
  KAFKA_CONSUMER_BROKERS: string;
  KAFKA_PRODUCER_BROKERS: string;
  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  KAFKA_ALLOW_AUTO_TOPIC_CREATION: boolean;
  KAFKA_AUTO_COMMIT: boolean;
  KAFKA_FROM_BEGINING: boolean;
  KAFKA_TOPIC: string;
  KAFKA_AUDIT_LOG_TOPIC: string;
}

export interface IGoogleConfig {
  GOOGLE_KEY: string;
}

export interface IBlobConfig {
  BLOB_URL: string;
  BLOB_SAS_TOKEN: string;
  BLOB_CONNECTION_STRING: string;
  BLOB_CONTAINER_NAME: string;
}

export interface ICdnConfig {
  CDN_LINK: string;
  CDN_AUTHORIZATION: string;
}

export interface IGrafanaConfig {
  OTEL_EXPORTER_OTLP_ENDPOINT: string;
  SERVICE_NAME: string;
}
