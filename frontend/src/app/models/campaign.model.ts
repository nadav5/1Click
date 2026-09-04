export interface ScrapedProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  imageUrls: string[];
  sourceUrl: string;
}

export interface MarketingData {
  facebookAdCopies: string[];
  targetAudience: string[];
  keywords: string[];
}

export interface MediaAssets {
  images: string[];
  videoUrl: string;
  localImagePaths?: string[];
  localVideoPath?: string;
}

export interface CampaignResponse {
  success: boolean;
  productId: string;
  product: ScrapedProduct;
  marketing: MarketingData;
  media: MediaAssets;
  timestamp: string;
  message?: string;
}
