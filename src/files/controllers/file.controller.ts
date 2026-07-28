import { Controller, HttpStatus, ParseFilePipeBuilder, Post, UploadedFile, UseInterceptors, StreamableFile, Body, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesAzureService } from '../services/file.service';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { LlmImageOptimizationService } from '../../shared/services/llm-image-optimization.service';

@Controller('files')
export class FileController {
  constructor(
    private readonly fileService: FilesAzureService,
    private readonly llmImageOptimizationService: LlmImageOptimizationService
  ) {}

  @Post('upload-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload a single image file' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpg, jpeg, png)',
        },
      },
      required: ['image'],
    },
  })
  async create(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png)$/,
        })
        .addMaxSizeValidator({
          //10 megabyte
          maxSize: 10485760,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        })
    )
    file: Express.Multer.File
  ) {
    const upload = await this.fileService.uploadFile(file);
    return { url: upload };
  }

  @Post('optimize-image-buffer')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload an image and get back an optimized buffer (No CDN upload)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpg, jpeg, png)',
        },
      },
      required: ['image'],
    },
  })
  async optimizeBuffer(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: 10485760 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY })
    )
    file: Express.Multer.File,
    @Body('context') context?: string,
    @Res() res?: any
  ) {
    const optimizedBuffer = await this.llmImageOptimizationService.process(file.buffer, context);
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'attachment; filename="optimized-image.jpg"',
    });
    return res.send(optimizedBuffer);
  }
}
