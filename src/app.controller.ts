import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiExcludeController } from '@nestjs/swagger';
import { CustomPinoLogger } from './logger/custom-logger.service';

@ApiExcludeController()
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly logger: CustomPinoLogger
  ) {}

  @Get()
  getHello(): string {
    this.logger.info('test traces');
    return this.appService.getHello();
  }
}
