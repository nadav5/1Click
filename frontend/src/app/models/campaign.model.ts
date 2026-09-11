export interface ProductReview {
  author: string;
  rating: number;
  text: string;
  date?: string;
  country?: string;
  highlight?: string;
}

export interface ScrapedProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  imageUrls: string[];
  reviews: ProductReview[];
  sourceUrl: string;
}

export interface MarketingData {
  facebookAdCopies: string[];
  targetAudience: string[];
  keywords: string[];
  customerReviews?: ProductReview[];
  imagePrompts?: string[];
}

export interface MediaAssets {
  images: string[];
  videoUrl: string;
  localImagePaths?: string[];
  localVideoPath?: string;
}

export interface AnalyzeTextResponse {
  success: boolean;
  productId: string;
  product: ScrapedProduct;
  marketing: MarketingData;
  productData?: ScrapedProduct;
  aiTextContext?: MarketingData;
  timestamp: string;
  message?: string;
}

export interface GenerateMediaResponse {
  success: boolean;
  productId?: string;
  media: MediaAssets;
  timestamp?: string;
  message?: string;
}

export interface GenerateMediaPayload {
  productId: string;
  title: string;
  description?: string;
  price?: string;
  imageUrls?: string[];
  imagePrompts?: string[];
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
