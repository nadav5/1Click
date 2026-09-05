import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CampaignController } from './campaign.controller.js';
import { ScraperService } from './scraper.service.js';
import { AiContentService } from './ai-content.service.js';
import { MediaProcessingService } from './media.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [CampaignController],
  providers: [ScraperService, AiContentService, MediaProcessingService],
  exports: [ScraperService, AiContentService, MediaProcessingService],
})
export class CampaignModule {}
