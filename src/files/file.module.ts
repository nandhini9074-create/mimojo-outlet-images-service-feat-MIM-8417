import { Global, Module } from '@nestjs/common';
import { FilesAzureService } from './services/file.service';
import { FileController } from './controllers/file.controller';
import { CdnUploadService } from 'src/shared/services/cdn-upload.service';
import { HttpModule } from 'src/shared/module/httpModule.module';
import { CustomLoggerModule } from 'src/logger/logger.module';
import { LlmModule } from '../shared/module/llm.module';

@Global()
@Module({
  imports: [HttpModule, CustomLoggerModule, LlmModule],
  controllers: [FileController],
  providers: [FilesAzureService, CdnUploadService],
  exports: [FilesAzureService],
})
export class FileModule {}
