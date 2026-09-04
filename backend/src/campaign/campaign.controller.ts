import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ScraperService } from './scraper.service.js';
import { AiContentService } from './ai-content.service.js';
import { MediaProcessingService } from './media.service.js';
import { GenerateCampaignDto } from './campaign.dto.js';
import type { CampaignResponse } from './campaign.interface.js';

@Controller('api/campaign')
export class CampaignController {
  private readonly logger = new Logger(CampaignController.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly aiContentService: AiContentService,
    private readonly mediaService: MediaProcessingService,
  ) {}

  /**
   * POST /api/campaign/generate
   * Orchestrates 1-Click campaign generation:
   * 1. Scrape product data from AliExpress (title, description, price, images)
   * 2. Generate marketing copy, audience segments, and keywords with Gemini AI
   * 3. Download, resize images to 1080x1080, and generate a 10-second promo MP4 video
   *
   * @param dto Object containing AliExpress product URL
   * @returns Unified campaign payload
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

      // Step 3: Process Media (Sharp 1080x1080 + FFmpeg 10-second slideshow)
      this.logger.log('[Step 3/3] Downloading, resizing images and generating promo video...');
      const media = await this.mediaService.processMedia(product.imageUrls, product.productId);

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
