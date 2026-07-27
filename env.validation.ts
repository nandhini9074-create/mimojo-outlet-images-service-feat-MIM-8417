import { IsEnum, IsNotEmpty, IsNumber, IsString, validateSync, IsBoolean, IsOptional, IsUrl } from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';
import { IAppConfig, ICredentialsConfig, IDatabaseConfig } from './config/interface';
import { Dialect } from 'sequelize/types';

export enum EnvironmentEnum {
  LOCAL = 'local',
  DEV = 'dev',
  STAGING = 'staging',
  PRODUCTION = 'prod',
}

export class EnvironmentVariables implements IAppConfig, ICredentialsConfig, IDatabaseConfig {
  @IsNotEmpty()
  @IsEnum(EnvironmentEnum)
  NODE_ENV: EnvironmentEnum;

  @IsNotEmpty()
  @IsString()
  SERVER_HTTP_HOST: string;

  @IsNotEmpty()
  @IsNumber()
  SERVER_HTTP_PORT: number;

  @IsNotEmpty()
  @IsString()
  DB_DIALECT: Dialect;

  @IsNotEmpty()
  @IsNumber()
  DB_PORT: number;

  @IsNotEmpty()
  @IsString()
  DB_DATABASE: string;

  @IsNotEmpty()
  @Transform(({ obj }) => {
    const { DB_AUTO_LOAD_MODELS } = obj;
    return DB_AUTO_LOAD_MODELS === true || DB_AUTO_LOAD_MODELS == 'true';
  })
  @IsBoolean()
  DB_AUTO_LOAD_MODELS: boolean;

  @IsNotEmpty()
  @Transform(({ obj }) => {
    const { DB_SYNC } = obj;
    return DB_SYNC === true || DB_SYNC == 'true';
  })
  @IsBoolean()
  DB_SYNC: boolean;

  @IsNotEmpty()
  @IsBoolean()
  @Transform(({ obj }) => {
    const { DB_FORCE } = obj;
    return DB_FORCE === true || DB_FORCE == 'true';
  })
  DB_FORCE: boolean;

  @IsNotEmpty()
  @IsNumber()
  DB_POOL_MIN: number;

  @IsNotEmpty()
  @IsNumber()
  DB_POOL_MAX: number;

  @IsNotEmpty()
  @Transform(({ obj }) => {
    const { DB_LOGGING } = obj;
    return DB_LOGGING === true || DB_LOGGING === 'true';
  })
  @IsBoolean()
  DB_LOGGING: boolean;

  @IsNotEmpty()
  @Transform(({ obj }) => {
    const { DB_UNDERSCORED } = obj;
    return DB_UNDERSCORED === true || DB_UNDERSCORED === 'true';
  })
  @IsBoolean()
  DB_UNDERSCORED: boolean;

  @IsNotEmpty()
  @IsString()
  DB_HOST: string;

  @IsNotEmpty()
  @IsString()
  DB_USERNAME: string;

  @IsNotEmpty()
  @IsString()
  DB_PASSWORD: string;

  @IsNotEmpty()
  @IsString()
  KAFKA_PRODUCER_BROKERS: string[];

  @IsNotEmpty()
  @IsString()
  KAFKA_CONSUMER_BROKERS: string[];

  @IsNotEmpty()
  @IsString()
  KAFKA_CLIENT_ID: string;

  @IsNotEmpty()
  @IsString()
  KAFKA_GROUP_ID: string;

  @IsNotEmpty()
  @IsBoolean()
  KAFKA_ALLOW_AUTO_TOPIC_CREATION: boolean;

  @IsNotEmpty()
  @IsBoolean()
  KAFKA_AUTO_COMMIT: boolean;

  @IsNotEmpty()
  @IsBoolean()
  KAFKA_FROM_BEGINING: boolean;

  @IsNotEmpty()
  @IsString()
  KAFKA_TOPIC: string;

  @IsNotEmpty()
  @IsString()
  KAFKA_AUDIT_LOG_TOPIC: string;

  @IsNotEmpty()
  @Transform(({ obj }) => {
    const { IS_SWAGGER_ENABLED } = obj;
    return IS_SWAGGER_ENABLED === true || IS_SWAGGER_ENABLED == 'true';
  })
  @IsBoolean()
  IS_SWAGGER_ENABLED: boolean;

  @IsOptional()
  @IsString()
  @IsUrl()
  DOMAIN_URL: string;

  @IsNotEmpty()
  @IsString()
  OTEL_EXPORTER_OTLP_ENDPOINT: string;

  @IsNotEmpty()
  @IsString()
  SERVICE_NAME: string;

  @IsNotEmpty()
  @IsString()
  AUDIT_LOG_NODE_HERO_IMAGE: string;

  @IsNotEmpty()
  @IsString()
  GEMINI_API_KEY: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
