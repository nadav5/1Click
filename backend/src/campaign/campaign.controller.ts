import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ScraperService } from './scraper.service.js';
import { AiContentService } from './ai-content.service.js';
import { MediaProcessingService } from './media.service.js';
import { GenerateCampaignDto, AnalyzeTextDto, GenerateMediaDto } from './campaign.dto.js';
import type {
  CampaignResponse,
  AnalyzeTextResponse,
  GenerateMediaResponse,
} from './campaign.interface.js';

@Controller('api/campaign')
export class CampaignController {
  private readonly logger = new Logger(CampaignController.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly aiContentService: AiContentService,
    private readonly mediaService: MediaProcessingService,
  ) {}

  /**
   * GET /api/campaign/test-imgly
   * Live diagnostic endpoint to test @imgly/background-removal-node memory consumption and resilience.
   */
  @Get('test-imgly')
  async testImgly(): Promise<{
    success: boolean;
    timeTakenMs: number;
    memoryUsedMb: number;
    message: string;
    details?: any;
  }> {
    this.logger.log('Executing live diagnostic for @imgly memory consumption and resilience...');
    return await this.mediaService.testImglyMemory();
  }

  /**
   * POST /api/campaign/analyze-text
   * Step 1 of progressive loading:
   * 1. Scrapes product details from AliExpress
   * 2. Prompts Gemini AI for PAS/AIDA/Story copy, demographics, keywords, and reviews
   * Returns immediately so the user can review and copy text without waiting for media.
   */
  @Post('analyze-text')
  @HttpCode(HttpStatus.OK)
  async analyzeText(@Body() dto: AnalyzeTextDto): Promise<AnalyzeTextResponse> {
    if (!dto || !dto.url) {
      throw new BadRequestException('A valid "url" parameter is required.');
    }

    const trimmedUrl = dto.url.trim();
    this.logger.log(`[Progressive Step 1/2] Analyzing text for: ${trimmedUrl}`);

    try {
      // Step 1: Scrape AliExpress Product Data
      this.logger.log('Scraping product information from AliExpress...');
      const product = await this.scraperService.scrapeAliexpress(trimmedUrl);

      // Step 2: Generate AI Marketing Content (Gemini)
      this.logger.log('Generating direct-response marketing copy with Gemini...');
      const marketing = await this.aiContentService.generateMarketingData(product);

      this.logger.log(`Successfully generated marketing text for: ${product.title}`);

      return {
        success: true,
        productId: product.productId,
        product,
        marketing,
        productData: product,
        aiTextContext: marketing,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Text analysis pipeline failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /api/campaign/generate-media
   * Step 2 of progressive loading:
   * Generates 4 lifestyle images via Pollinations AI (with fallback to scraped images)
   * and stitches a 10s crossfade promo video with FFmpeg.
   */
  @Post('generate-media')
  @HttpCode(HttpStatus.OK)
  async generateMedia(@Body() dto: GenerateMediaDto): Promise<GenerateMediaResponse> {
    if (!dto || !dto.productId) {
      throw new BadRequestException('A valid "productId" is required.');
    }

    this.logger.log(`[Progressive Step 2/2] Generating media assets for product ${dto.productId}...`);

    try {
      const media = await this.mediaService.processMedia(
        dto.imageUrls || [],
        dto.productId,
        dto.title,
        dto.description,
        dto.price,
        dto.imagePrompts,
      );

      this.logger.log(`Successfully generated media for product: ${dto.productId}`);

      return {
        success: true,
        productId: dto.productId,
        media,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Media generation pipeline failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * POST /api/campaign/generate
   * Unified single-call endpoint (backwards compatible):
   * 1. Scrape product data from AliExpress
   * 2. Generate marketing copy with Gemini
   * 3. Generate lifestyle images (Sharp 1080x1080 DTC Creatives) & 10s MP4 promo video
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateCampaign(@Body() dto: GenerateCampaignDto): Promise<CampaignResponse> {
    if (!dto || !dto.url) {
      throw new BadRequestException('A valid "url" parameter is required.');
    }

    const trimmedUrl = dto.url.trim();
    this.logger.log(`Received request to generate marketing campaign for: ${trimmedUrl}`);

    try {
      // Step 1: Scrape AliExpress Product Data
      this.logger.log('[Step 1/3] Scraping product information...');
      const product = await this.scraperService.scrapeAliexpress(trimmedUrl);

      // Step 2: Generate AI Marketing Content (Gemini)
      this.logger.log('[Step 2/3] Generating AI marketing copy with Gemini...');
      const marketing = await this.aiContentService.generateMarketingData(product);

      // Step 3: Process Media (Sharp 1080x1080 DTC Creatives + FFmpeg 10s video)
      this.logger.log('[Step 3/3] Generating lifestyle media and promo video...');
      const media = await this.mediaService.processMedia(
        product.imageUrls,
        product.productId,
        product.title,
        product.description,
        product.price,
        marketing.imagePrompts,
      );

      this.logger.log(`Successfully generated campaign for: ${product.title}`);

      return {
        success: true,
        productId: product.productId,
        product,
        marketing,
        media,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`Campaign generation pipeline failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}

