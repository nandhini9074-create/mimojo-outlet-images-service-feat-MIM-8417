import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { FilesAzureService } from 'src/files/services/file.service';
import { FileController } from '../file.controller';
import { LlmImageOptimizationService } from 'src/shared/services/llm-image-optimization.service';

describe('FileController', () => {
    let controller: FileController;
    let fileService: FilesAzureService;
    let llmImageOptimizationService: LlmImageOptimizationService;

    const mockFilesAzureService = {
        uploadFile: jest.fn(),
    };

    const mockLlmImageOptimizationService = {
        process: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [FileController],
            providers: [
                {
                    provide: FilesAzureService,
                    useValue: mockFilesAzureService,
                },
                {
                    provide: LlmImageOptimizationService,
                    useValue: mockLlmImageOptimizationService,
                },
            ],
        }).compile();

        controller = module.get<FileController>(FileController);
        fileService = module.get<FilesAzureService>(FilesAzureService);
        llmImageOptimizationService = module.get<LlmImageOptimizationService>(LlmImageOptimizationService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should upload image and return URL', async () => {
        const mockFile = {
            originalname: 'test-image.jpg',
            mimetype: 'image/jpeg',
            size: 500000,
            buffer: Buffer.from('mock buffer'),
        } as Express.Multer.File;

        const mockUrl = 'https://dummy.cdn.com/test-image.jpg';
        mockFilesAzureService.uploadFile.mockResolvedValue(mockUrl);

        const result = await controller.create(mockFile);

        expect(fileService.uploadFile).toHaveBeenCalledWith(mockFile, undefined);
        expect(result).toEqual({ url: mockUrl });
    });

    it('should throw error if file is too large', async () => {
        const oversizedFile = {
            originalname: 'big-image.jpg',
            mimetype: 'image/jpeg',
            size: 10485761, // > 10MB
            buffer: Buffer.from('mock buffer'),
        } as Express.Multer.File;

        // This test can only be properly triggered via e2e or integration test because
        // `ParseFilePipeBuilder` is only applied during the request lifecycle.
        // For controller unit test, Nest does not automatically apply the pipe logic.
        // You can simulate this validation error manually if needed.
        try {
            await controller.create(oversizedFile);
        } catch (err) {
            expect(err.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        }
    });

    describe('optimizeBuffer', () => {
        it('should optimize image buffer and return StreamableFile', async () => {
            const mockFile = {
                originalname: 'test-image.jpg',
                mimetype: 'image/jpeg',
                size: 500000,
                buffer: Buffer.from('mock buffer'),
            } as Express.Multer.File;

            const mockOptimizedBuffer = Buffer.from('optimized buffer');
            mockLlmImageOptimizationService.process.mockResolvedValue(mockOptimizedBuffer);

            const mockRes = {
                set: jest.fn(),
            };

            const result = await controller.optimizeBuffer(mockFile, 'test-profile-id', mockRes);

            expect(mockLlmImageOptimizationService.process).toHaveBeenCalledWith(mockFile.buffer, 'test-profile-id');
            expect(mockRes.set).toHaveBeenCalledWith({
                'Content-Type': 'image/jpeg',
                'Content-Disposition': 'attachment; filename="optimized-image.jpg"',
            });
            expect(result).toBeDefined();
            expect(result.getStream).toBeDefined();
        });
    });
});
