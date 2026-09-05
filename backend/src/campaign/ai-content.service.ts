import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MarketingData, ScrapedProduct } from './campaign.interface.js';

@Injectable()
export class AiContentService implements OnModuleInit {
  private readonly logger = new Logger(AiContentService.name);
  private readonly modelName = 'gemini-1.5-flash';

  onModuleInit(): void {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      this.logger.warn(
        '⚠️ [STARTUP WARNING] GEMINI_API_KEY is undefined, empty, or missing in environment variables! ' +
          'Please configure GEMINI_API_KEY in the Render service settings (Environment tab). ' +
          'Requests will automatically use the dynamic algorithmic copy generator.',
      );
    } else {
      this.logger.log(
        `✅ [STARTUP CHECK] GEMINI_API_KEY is configured (Key exists: true, length: ${apiKey.length}). Target model: "${this.modelName}".`,
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

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const keyExists = !!(apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE');

    if (!keyExists) {
      this.logger.warn(
        `[AiContentService] Skipping Gemini API call because GEMINI_API_KEY is missing or empty (Key exists: ${keyExists}). Using dynamic algorithmic generator.`,
      );
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
  ]
}
`;

    try {
      this.logger.log(`Invoking Gemini API using model: "${this.modelName}"...`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
        this.logger.log(
          `Successfully generated dynamic marketing copy for "${productData.title}" from Gemini API (gemini-1.5-flash).`,
        );
        return parsed;
      }

      throw new Error('Parsed response does not match expected interface');
    } catch (error: any) {
      this.logger.error(
        `[AiContentService] Gemini API generation failed for "${productData.title}". ` +
          `Model: "gemini-1.5-flash", ` +
          `Key exists: ${keyExists}, ` +
          `Error: ${error?.message || error}. ` +
          `Stack: ${error?.stack || 'N/A'}. ` +
          `Falling back to dynamic algorithmic copy generator.`,
      );
      return this.generateFallbackMarketingData(productData);
    }
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
    };
  }
}
