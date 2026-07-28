import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { LlmPromptConfig } from '../models/llm-prompt-config.model';
import { GoogleGenerativeAI } from '@google/generative-ai';
const sharp = require('sharp');

@Injectable()
export class LlmImageOptimizationService {
  private readonly logger = new Logger(LlmImageOptimizationService.name);
  private ai: GoogleGenerativeAI;

  constructor(
    @InjectModel(LlmPromptConfig)
    private readonly llmPromptConfigModel: typeof LlmPromptConfig,
    private readonly configService: ConfigService
  ) {
    const apiKey = this.configService.get<string>('llm.GEMINI_API_KEY');
    if (apiKey) {
      this.ai = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY is not configured.');
    }
  }

  public async process(buffer: Buffer, context?: string): Promise<Buffer> {
    try {
      // 1. Fetch prompt from DB
      const config = await this.llmPromptConfigModel.findOne();
      if (!config) {
        throw new Error('No LLM prompt config found in DB.');
      }

      if (!this.ai) {
        throw new Error('Gemini AI not initialized.');
      }

      // 2. Prepare the prompt for Gemini
      const prompt = config.promptText;

      const mimeType = 'image/jpeg';
      const base64Data = buffer.toString('base64');

      // 3. Call Gemini Vision
      const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        }
      ]);

      const responseText = response.response.text();
      let cropCoords;
      try {
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '');
        cropCoords = JSON.parse(cleanedText);
      } catch (parseError) {
        this.logger.error('Failed to parse Gemini response as JSON', { responseText, parseError });
        throw new Error(`Failed to parse Gemini response as JSON: ${parseError.message}`);
      }

      if (cropCoords && cropCoords.left !== undefined && cropCoords.top !== undefined && cropCoords.width && cropCoords.height) {
        this.logger.log(`Resizing based on Gemini coordinates: ${JSON.stringify(cropCoords)}`);

        // 4. Apply crop and resize using sharp
        const imageMetadata = await sharp(buffer).metadata();
        const safeLeft = Math.max(0, Math.min(cropCoords.left, imageMetadata.width - 1));
        const safeTop = Math.max(0, Math.min(cropCoords.top, imageMetadata.height - 1));
        const safeWidth = Math.min(cropCoords.width, imageMetadata.width - safeLeft);
        const safeHeight = Math.min(cropCoords.height, imageMetadata.height - safeTop);

        return await sharp(buffer)
          .extract({ left: Math.floor(safeLeft), top: Math.floor(safeTop), width: Math.floor(safeWidth), height: Math.floor(safeHeight) })
          .toBuffer();
      }

      throw new Error(`Invalid crop coordinates returned by LLM: ${JSON.stringify(cropCoords)}`);
    } catch (error) {
      this.logger.error('LlmImageOptimizationService process error', { error });
      throw error;
    }
  }
}
