import { HttpService, HttpModule as BaseHttpModule } from '@nestjs/axios';
import { Module, OnModuleInit } from '@nestjs/common';
import { CustomPinoLogger } from 'src/logger/custom-logger.service';
import { CustomLoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [BaseHttpModule, CustomLoggerModule],
  exports: [BaseHttpModule],
})
export class HttpModule implements OnModuleInit {
  constructor(
    private readonly logger: CustomPinoLogger,
    private readonly httpService: HttpService
  ) {}

  public onModuleInit(): void {
    const axios = this.httpService.axiosRef;
    axios.interceptors.response.use(
      response => {
        this.logging(response, 'info');
        return response;
      },
      err => {
        this.logging(err.response, 'error');
        return Promise.reject(err);
      }
    );
  }

  private logging(response, level: string): void {
    const { config } = response;
    const url = new URL(config.url);
    const loggerMeta = {
      timestamp: new Date().getTime(),
      request: {
        url: url.href,
        method: response.request.method,
        body: config.data,
        headers: config.headers,
      },
      responseBody: response.data,
    };
    if (level === 'error') {
      this.logger.error(`${url.hostname} response`, { loggerMeta });
    } else {
      this.logger.info(`${url.hostname} response`, { loggerMeta });
    }
  }
}
