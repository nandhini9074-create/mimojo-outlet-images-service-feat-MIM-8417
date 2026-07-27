import { Module } from '@nestjs/common';
import { CustomPinoLogger } from './custom-logger.service';

@Module({
  providers: [CustomPinoLogger],
  exports: [CustomPinoLogger],
})
export class CustomLoggerModule {}
