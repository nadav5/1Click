import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller.js';
import { ScraperService } from './scraper.service.js';
import { AiContentService } from './ai-content.service.js';
import { MediaProcessingService } from './media.service.js';

@Module({
  controllers: [CampaignController],
  providers: [ScraperService, AiContentService, MediaProcessingService],
  exports: [ScraperService, AiContentService, MediaProcessingService],
})
export class CampaignModule {}
