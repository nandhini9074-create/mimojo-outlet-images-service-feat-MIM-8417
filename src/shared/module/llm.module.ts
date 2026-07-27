import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LlmPromptConfig } from '../models/llm-prompt-config.model';
import { LlmImageOptimizationService } from '../services/llm-image-optimization.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    SequelizeModule.forFeature([LlmPromptConfig]),
    ConfigModule,
  ],
  providers: [LlmImageOptimizationService],
  exports: [LlmImageOptimizationService],
})
export class LlmModule {}
