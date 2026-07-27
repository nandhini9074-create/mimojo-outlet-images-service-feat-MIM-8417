import './tracer';
import { VersioningType } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { appConfig } from 'config/server.config';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { EnvironmentEnum } from 'env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { SERVER_HTTP_HOST, SERVER_HTTP_PORT, IS_SWAGGER_ENABLED, DOMAIN_URL, NODE_ENV } = appConfig();

  app.useGlobalPipes();
  app.enableCors();

  if (IS_SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('Outlet image service')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addServer(`${DOMAIN_URL}`, 'Domain URL')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'access-token'
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);

    const docsDir = path.resolve(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const filePath = path.join(docsDir, 'swagger.json');
    fs.writeFileSync(filePath, JSON.stringify(document, null, 2));
    if (NODE_ENV === EnvironmentEnum.LOCAL) SwaggerModule.setup('api-docs', app, document);
  }
  app.enableVersioning({
    defaultVersion: '1',
    prefix: 'v',
    type: VersioningType.URI,
  });

  const httpAdapterHost = app.get(HttpAdapterHost);

  // Redirect root path to a specific versioned route
  app.use((req, res, next) => {
    if (req.originalUrl === '/') {
      res.redirect(`/v1${req.originalUrl}`);
    } else {
      next();
    }
  });
  await app.listen(SERVER_HTTP_PORT);
  console.log(`Http Server is running over: ${SERVER_HTTP_HOST}:${SERVER_HTTP_PORT}`);
}

bootstrap();
