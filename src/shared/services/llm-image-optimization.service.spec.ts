import { Test, TestingModule } from '@nestjs/testing';
import { LlmImageOptimizationService } from './llm-image-optimization.service';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/sequelize';
import { LlmPromptConfig } from '../models/llm-prompt-config.model';

const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        }),
      };
    }),
  };
});

const mockToBuffer = jest.fn();
const mockExtract = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
const mockMetadata = jest.fn();
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    metadata: mockMetadata,
    extract: mockExtract,
  }));
});

describe('LlmImageOptimizationService', () => {
  let service: LlmImageOptimizationService;
  let configService: ConfigService;
  let llmPromptConfigModel: typeof LlmPromptConfig;

  const mockFindOne = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmImageOptimizationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
        {
          provide: getModelToken(LlmPromptConfig),
          useValue: {
            findOne: mockFindOne,
          },
        },
      ],
    }).compile();

    service = module.get<LlmImageOptimizationService>(LlmImageOptimizationService);
    configService = module.get<ConfigService>(ConfigService);
    llmPromptConfigModel = module.get<typeof LlmPromptConfig>(getModelToken(LlmPromptConfig));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('process', () => {
    const mockBuffer = Buffer.from('test-image');

    it('should successfully process image and return cropped buffer with context', async () => {
      mockFindOne.mockResolvedValue({ promptText: 'test prompt' });
      
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '```json\n{"left": 10, "top": 10, "width": 100, "height": 100}\n```',
        },
      });

      mockMetadata.mockResolvedValue({ width: 500, height: 500 });
      mockToBuffer.mockResolvedValue(Buffer.from('cropped-image'));

      const result = await service.process(mockBuffer, 'merchant-profile');

      expect(mockFindOne).toHaveBeenCalledWith({ where: { context: 'merchant-profile' } });
      expect(result).toEqual(Buffer.from('cropped-image'));
      expect(mockExtract).toHaveBeenCalledWith({
        left: 10,
        top: 10,
        width: 100,
        height: 100,
      });
    });

    it('should fallback to default context if not provided', async () => {
      mockFindOne.mockResolvedValue({ promptText: 'test prompt' });
      mockGenerateContent.mockResolvedValue({ response: { text: () => '{"left": 10, "top": 10, "width": 100, "height": 100}' } });
      mockMetadata.mockResolvedValue({ width: 500, height: 500 });
      mockToBuffer.mockResolvedValue(Buffer.from('cropped-image'));

      await service.process(mockBuffer);
      expect(mockFindOne).toHaveBeenCalledWith({ where: { context: 'default' } });
    });

    it('should throw error if config not found for context', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(service.process(mockBuffer, 'merchant-profile')).rejects.toThrow('No LLM prompt config found in DB for context: merchant-profile');
    });

    it('should throw error if LLM returns invalid JSON', async () => {
      mockFindOne.mockResolvedValue({ promptText: 'test prompt' });
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'not json',
        },
      });

      await expect(service.process(mockBuffer)).rejects.toThrow('Failed to parse Gemini response as JSON');
    });

    it('should throw error if LLM returns missing crop coordinates', async () => {
      mockFindOne.mockResolvedValue({ promptText: 'test prompt' });
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '{"left": 10}', // missing top, width, height
        },
      });

      await expect(service.process(mockBuffer)).rejects.toThrow('Invalid crop coordinates returned by LLM');
    });
  });
});
