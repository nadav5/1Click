import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MarketingData, ScrapedProduct } from './campaign.interface.js';

@Injectable()
export class AiContentService implements OnModuleInit {
  private readonly logger = new Logger(AiContentService.name);
  private modelName = 'gemini-3.6-flash';
  private readonly candidateModels = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const configuredModel = this.configService.get<string>('GEMINI_MODEL');
    if (configuredModel && configuredModel.trim().length > 0 && configuredModel !== 'gemini-1.5-flash') {
      this.modelName = configuredModel.trim();
    } else {
      this.modelName = 'gemini-3.6-flash';
    }

    const rawKey = this.configService.get<string>('GEMINI_API_KEY');
    const apiKey = rawKey?.trim().replace(/^["']|["']$/g, '');
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      this.logger.warn(
        '⚠️ [STARTUP WARNING] GEMINI_API_KEY is undefined, empty, or missing in ConfigService! ' +
          'Please configure GEMINI_API_KEY in the Render service settings (Environment tab). ' +
          'Requests will automatically use the dynamic algorithmic copy generator.',
      );
    } else {
      this.logger.log(
        `✅ [STARTUP CHECK] GEMINI_API_KEY is configured in ConfigService (Key exists: true, length: ${apiKey.length}). Target model: "${this.modelName}".`,
      );
    }
  }

  /**
   * Generates viral dropshipping marketing copy, target audience segments,
   * high-intent e-commerce keywords, and top analyzed customer reviews for the given product.
   *
   * @param productData ScrapedProduct containing title, price, description, and scraped reviews
   * @returns Structured MarketingData object
   */
  async generateMarketingData(productData: ScrapedProduct): Promise<MarketingData> {
    this.logger.log(`Generating dynamic marketing copy for: "${productData.title}"`);

    const rawApiKey = this.configService.get<string>('GEMINI_API_KEY');
    const apiKey = rawApiKey?.trim().replace(/^["']|["']$/g, '');

    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      this.logger.error('API Key is missing or undefined from ConfigService!');
      this.logger.warn('Falling back to dynamic algorithmic copy generator.');
      return this.generateFallbackMarketingData(productData);
    }

    const reviewsSnippet =
      productData.reviews && productData.reviews.length > 0
        ? productData.reviews
            .map(
              (r, i) =>
                `${i + 1}. [${r.rating} Stars - ${r.author} (${r.country || 'Global'})]: "${r.text}"`,
            )
            .join('\n')
        : 'No customer reviews available.';

    const prompt = `
You are an Elite E-commerce Media Buyer and Direct-Response Copywriter who has scaled multiple 8-figure DTC consumer brands.
Analyze this specific e-commerce product and its authentic customer reviews to craft high-converting ad copy, audience intelligence, and top analyzed social proof:

PRODUCT TITLE: ${productData.title}
PRODUCT PRICE: ${productData.price}
PRODUCT DESCRIPTION: ${productData.description}

REAL CUSTOMER REVIEWS:
${reviewsSnippet}

MANDATORY PRODUCT RELEVANCE:
- Every single ad copy, target audience segment, and keyword MUST BE 100% SPECIFIC TO "${productData.title}".
- DO NOT use generic desk lamp, electronics, or gadget templates if this product belongs to a different niche (e.g., fashion, beauty/skincare, pet products, automotive, fitness, kitchenware, toys, etc.).
- Directly address who actually uses this item, its real-world problem, and its specific value proposition.

INSTRUCTIONS FOR DIRECT-RESPONSE HOOKS & PAIN POINTS:
- Deeply analyze the provided customer reviews to pinpoint real consumer pain points, specific praised features, surprising benefits, and authentic quotes.
- Directly embed these real customer sentiments, friction points, and objections into the 3 Facebook ad copies.

CRITICAL TONE & STYLE RULES:
- Write like a real, persuasive, human direct-response expert selling to skeptical buyers.
- STRICT BAN on generic AI buzzwords: NEVER use words like "revolutionary", "unleash", "game-changer", "delve", "miracle", "tapestry", "in a world where...", "look no further", or "elevate your experience".
- Every ad must have a distinct angle, authentic voice, natural emojis, clear value propositions, and a decisive, low-friction CTA.

FRAMEWORKS REQUIRED:
- Copy 1: PAS (Problem - Agitation - Solution) Framework
  * Problem: Pinpoint an exact, irritating friction point relevant to "${productData.title}".
  * Agitation: Highlight the hidden frustration, wasted time, or cost of bad alternatives.
  * Solution: Present "${productData.title}" as the obvious, effortless fix. End with a clear call to action and pricing incentive (${productData.price}).
- Copy 2: AIDA (Attention - Interest - Desire - Action) Framework
  * Attention: An arrestingly specific scroll-stopping hook calling out the buyer or a relatable situation.
  * Interest: An intriguing mechanism or praised feature from the product details.
  * Desire: A concrete before-and-after transformation (what daily life feels like with this product).
  * Action: A low-friction, decisive CTA with social proof and risk-reversal (guarantee, fast shipping).
- Copy 3: Story-Driven & Social Proof Framework
  * Open from a relatable customer perspective or narrative quoting the reviews ("I was skeptical about buying this at first...").
  * Overcome natural objection/skepticism with authentic, grounded social proof.
  * Close with urgency or limited promotional availability (${productData.price}).

AUDIENCE, KEYWORDS & CUSTOMER REVIEWS:
- "targetAudience": 3 ultra-targeted demographic & interest segments ready to paste into Meta Ads Manager tailored strictly to "${productData.title}". Include age ranges, specific Facebook interest categories, and buying behaviors.
- "keywords": 5 high-intent commercial search keywords and niche hashtags directly matching "${productData.title}".
- "customerReviews": 4 to 6 top analyzed reviews representing the strongest customer proof points. Each review must have "author", "rating" (number, e.g. 5), "text", "date", "country", and a short "highlight" (e.g., "Build Quality", "Time Saver", "Unbeatable Value").
- "imagePrompts": 4 highly detailed commercial image generation prompts specifically for "${productData.title}". Prompt 1 must feature a real person actively using the product in a modern lifestyle setting. Prompt 2 must be an aesthetic environment or room setup featuring the product. Prompt 3 must be a high-end commercial studio product shot. Prompt 4 must be a close-up lifestyle action shot showing texture and quality.

OUTPUT FORMAT:
Return ONLY a valid, raw JSON object (no markdown formatting, no code blocks, no backticks, no preamble) with this exact schema:
{
  "facebookAdCopies": [
    "PAS framework ad copy...",
    "AIDA framework ad copy...",
    "Story/Social proof ad copy..."
  ],
  "targetAudience": [
    "Audience segment 1...",
    "Audience segment 2...",
    "Audience segment 3..."
  ],
  "keywords": [
    "#keyword1",
    "#keyword2",
    "#keyword3",
    "#keyword4",
    "#keyword5"
  ],
  "customerReviews": [
    {
      "author": "Marcus K.",
      "rating": 5,
      "text": "Exceeded my expectations...",
      "date": "Verified Buyer · 4 days ago",
      "country": "US",
      "highlight": "Premium Build Quality"
    }
  ],
  "imagePrompts": [
    "A photorealistic commercial lifestyle photo of a person actively using...",
    "A clean, aesthetic modern living or desk space featuring...",
    "A commercial studio product photograph of...",
    "A dynamic close-up lifestyle shot of..."
  ]
}
`;

    const modelsToTry = [
      this.modelName,
      ...this.candidateModels.filter((m) => m !== this.modelName),
    ];

    const genAI = new GoogleGenerativeAI(apiKey.trim());

    for (const currentModel of modelsToTry) {
      try {
        this.logger.log(`Invoking Gemini API using model: "${currentModel}"...`);
        const model = genAI.getGenerativeModel({ model: currentModel });

        const response = await model.generateContent(prompt);
        const rawText = response.response.text();

        // Clean response text to ensure clean JSON parsing
        const cleanedJson = this.extractJsonString(rawText);
        const parsed: MarketingData = JSON.parse(cleanedJson);

        // Validate structure
        if (
          Array.isArray(parsed.facebookAdCopies) &&
          Array.isArray(parsed.targetAudience) &&
          Array.isArray(parsed.keywords)
        ) {
          if (!parsed.customerReviews || parsed.customerReviews.length === 0) {
            parsed.customerReviews = productData.reviews ? productData.reviews.slice(0, 6) : [];
          }
          if (!Array.isArray(parsed.imagePrompts) || parsed.imagePrompts.length === 0) {
            const cleanTitle = productData.title.replace(/[^a-zA-Z0-9\s]/g, ' ').slice(0, 60).trim();
            parsed.imagePrompts = [
              `Photorealistic commercial lifestyle photography of a person actively and happily using ${cleanTitle} in a modern, stylish setting, authentic natural lighting, 8k resolution`,
              `A clean, aesthetic modern living space setup beautifully showcasing ${cleanTitle}, cinematic depth of field, warm ambient lighting, 8k`,
              `A sleek commercial studio product photograph of ${cleanTitle}, clean minimalist background, dramatic studio lighting, razor sharp details`,
              `A dynamic close-up candid lifestyle photo of hands interacting with ${cleanTitle}, showcasing high build quality and convenience`,
            ];
          }
          this.logger.log(
            `Successfully generated dynamic marketing copy for "${productData.title}" from Gemini API (${currentModel}).`,
          );
          this.modelName = currentModel;
          return parsed;
        }

        throw new Error('Parsed response does not match expected interface');
      } catch (error: any) {
        this.logger.warn(
          `[AiContentService] Model "${currentModel}" failed: ${error?.message || error}. Attempting next model if available...`,
        );
      }
    }

    this.logger.error(
      `[AiContentService] All Gemini models failed for "${productData.title}". Falling back to dynamic algorithmic copy generator.`,
    );
    return this.generateFallbackMarketingData(productData);
  }

  /**
   * Cleans markdown fences, extra whitespace, or commentary from model output.
   */
  private extractJsonString(raw: string): string {
    let text = raw.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    }
    return text.trim();
  }

  /**
   * High-converting dynamic copy generator built on proven PAS, AIDA, and Story frameworks.
   * Dynamically adapts to the scraped product title, keywords, and pricing.
   */
  private generateFallbackMarketingData(product: ScrapedProduct): MarketingData {
    const fullTitle = product.title.replace(/\s+/g, ' ').trim();
    const titleSnippet = fullTitle.slice(0, 50).trim();
    const priceText = product.price || '$24.99';

    // Extract significant keywords from title for dynamic hashtags & audience targeting
    const words = fullTitle
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 3 &&
          !['with', 'from', 'free', 'shipping', 'item', 'product', 'high', 'quality', 'trending', 'viral'].includes(
            w.toLowerCase(),
          ),
      );

    const primaryNiche = words.slice(0, 3).join(' ') || 'Trending Finds';
    const tag1 = words[0] ? `#${words[0].toLowerCase()}` : '#trendingfinds';
    const tag2 = words[1] ? `#${words[1].toLowerCase()}` : '#viralproducts';
    const tag3 = words[2] ? `#${words[2].toLowerCase()}` : '#dailyessentials';
    const tag4 = '#directfromfactory';
    const tag5 = '#toprated';

    const reviews =
      product.reviews && product.reviews.length > 0
        ? product.reviews
        : [
            {
              author: 'Marcus K.',
              rating: 5,
              text: `Honestly exceeded my expectations. The build quality of this ${titleSnippet} feels solid and durable. Shipped quickly and works exactly as advertised.`,
              date: 'Verified Buyer · 4 days ago',
              country: 'US',
              highlight: 'Verified Quality',
            },
            {
              author: 'Elena S.',
              rating: 5,
              text: `Saw this trending on social media and decided to give it a shot. Completely solves what I needed and saves me so much hassle. 10/10 purchase!`,
              date: 'Verified Buyer · 1 week ago',
              country: 'UK',
              highlight: 'High Utility',
            },
            {
              author: 'David R.',
              rating: 5,
              text: `I was skeptical given the price, but after daily use, it has been flawless. Customer service was responsive and tracking was updated constantly.`,
              date: 'Verified Buyer · 2 weeks ago',
              country: 'CA',
              highlight: 'Unbeatable Value',
            },
            {
              author: 'Sarah M.',
              rating: 5,
              text: `Super intuitive and aesthetically pleasing. Fits seamlessly into my daily routine. Bought an extra one as a gift for family!`,
              date: 'Verified Buyer · 2 weeks ago',
              country: 'AU',
              highlight: 'Everyday Practicality',
            },
          ];

    return {
      facebookAdCopies: [
        // Framework 1: PAS (Problem - Agitation - Solution)
        `Stop settling for cheap alternatives that underperform and break when you need them most.\n\nMost options on the market cut corners on materials, leaving you frustrated, out of pocket, and back at square one searching for a replacement.\n\nThe new ${titleSnippet} was engineered to fix that once and for all. Built with premium-grade construction and tested for everyday reliability, it delivers consistent performance right out of the box.\n\n👉 Flash Offer: Only ${priceText} (Special Launch Pricing)\n📦 Tracked worldwide delivery + 30-day money-back guarantee.\n\nTap "Shop Now" to secure yours before this production run sells out.`,

        // Framework 2: AIDA (Attention - Interest - Desire - Action)
        `Notice how most products look incredible in pictures, but feel disappointing the second you unbox them?\n\nHere is what makes this ${titleSnippet} different: precision craftsmanship and zero cut corners. Designed for peak utility without the ridiculous brand markup.\n\nImagine having a dependable solution that just works, simplifies your routine, and delivers genuine peace of mind day in and day out.\n\n🔥 Limited Release: ${priceText} (Save 40% Today)\n✅ Risk-Free 30-Day Guarantee + Fast Shipping\n\nClick below to claim yours today while promotional inventory lasts!`,

        // Framework 3: Story-Driven & Social Proof
        `"To be completely honest, I thought this was just another overhyped online product... until mine arrived."\n\nThousands of verified buyers made the switch to the ${titleSnippet} this month alone. The consensus? It replaces multiple clunky alternatives and gets the job done in half the time.\n\nNo gimmicks. Just solid durability, seamless design, and real everyday value.\n\n⭐ Rated 4.9/5 by verified customers\n🏷️ Starting at ${priceText} with complimentary tracking.\n\nClaim your special discount before stock is claimed for the season! 👇`,
      ],
      targetAudience: [
        `High-Intent Buyers (Ages 24-48, engaged online shoppers with demonstrated interest in ${primaryNiche} and viral direct-to-consumer bestsellers)`,
        `Lifestyle & Quality Seekers (Ages 26-55, targeting consumers looking for premium utility, problem-solving essentials, and high durability)`,
        `Impulse Social Shoppers (Ages 20-40, active buyers on TikTok & Instagram seeking top-rated ${primaryNiche} solutions with verified reviews)`,
      ],
      keywords: [tag1, tag2, tag3, tag4, tag5],
      customerReviews: reviews.slice(0, 6),
      imagePrompts: [
        `Photorealistic commercial lifestyle photography of a person actively using ${titleSnippet} in a modern stylish setting, authentic natural lighting, 8k`,
        `A clean minimalist aesthetic desk and living space beautifully showcasing ${titleSnippet}, warm ambient lighting, 8k resolution`,
        `A crisp commercial studio product shot of ${titleSnippet}, dramatic spotlight, dark elegant background, 8k resolution`,
        `A dynamic close-up candid lifestyle photo of hands interacting with ${titleSnippet}, premium build quality`,
      ],
    };
  }
}
