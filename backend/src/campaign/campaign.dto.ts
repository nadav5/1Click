export class GenerateCampaignDto {
  url!: string;
}

export class AnalyzeTextDto {
  url!: string;
}

export class GenerateMediaDto {
  productId!: string;
  title!: string;
  description?: string;
  price?: string;
  imageUrls?: string[];
}
