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
        this.logger.warn('No LLM prompt config found in DB, using fallback standard resize (1080x1080).');
        return this.fallbackResize(buffer, 1080, 1080);
      }

      if (!this.ai) {
        this.logger.warn('Gemini AI not initialized, using fallback standard resize.');
        return this.fallbackResize(buffer, config.targetWidth, config.targetHeight);
      }

      // 2. Prepare the prompt for Gemini
      const prompt = `${config.promptText} 
      Please analyze the image and return a JSON object with crop coordinates: 
      { "left": number, "top": number, "width": number, "height": number }. 
      Ensure the coordinates form the best crop for the primary subject to fit a ${config.targetWidth}x${config.targetHeight} aspect ratio. 
      Only return valid JSON without markdown wrapping.`;

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
        return this.fallbackResize(buffer, config.targetWidth, config.targetHeight);
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
          .resize(config.targetWidth, config.targetHeight, { fit: 'cover' })
          .toBuffer();
      }

      return this.fallbackResize(buffer, config.targetWidth, config.targetHeight);
    } catch (error) {
      this.logger.error('LlmImageOptimizationService process error', { error });
      return buffer; // return original buffer on critical failure
    }
  }

  private async fallbackResize(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    return await sharp(buffer)
      .resize(width, height, { fit: 'cover' })
      .toBuffer();
  }
}
