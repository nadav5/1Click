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
