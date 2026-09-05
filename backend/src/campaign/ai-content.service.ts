import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MarketingData, ScrapedProduct } from './campaign.interface.js';

@Injectable()
export class AiContentService {
  private readonly logger = new Logger(AiContentService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.logger.log(`Google Gemini initialized successfully with model: ${this.modelName}`);
      } catch (err: any) {
        this.logger.error(`Failed to initialize GoogleGenerativeAI: ${err.message}`);
      }
    } else {
      this.logger.warn(
        'GEMINI_API_KEY not configured in environment. Smart fallback copy generator will be used until an API key is provided.',
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
    this.logger.log(`Generating marketing copy for: "${productData.title}"`);

    // If Gemini client is not initialized, generate algorithmic marketing data
    if (!this.genAI) {
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
Analyze this e-commerce product and its authentic customer reviews to craft high-converting ad copy, audience intelligence, and top analyzed social proof:

PRODUCT TITLE: ${productData.title}
PRODUCT PRICE: ${productData.price}
PRODUCT DESCRIPTION: ${productData.description}

REAL CUSTOMER REVIEWS:
${reviewsSnippet}

INSTRUCTIONS FOR DIRECT-RESPONSE HOOKS & PAIN POINTS:
- Deeply analyze the provided customer reviews to pinpoint real consumer pain points, specific praised features, surprising benefits, and authentic quotes.
- Directly embed these real customer sentiments, friction points, and objections into the 3 Facebook ad copies.

CRITICAL TONE & STYLE RULES:
- Write like a real, persuasive, human direct-response expert selling to skeptical buyers.
- STRICT BAN on generic AI buzzwords: NEVER use words like "revolutionary", "unleash", "game-changer", "delve", "miracle", "tapestry", "in a world where...", "look no further", or "elevate your experience".
- Every ad must have a distinct angle, authentic voice, natural emojis, clear value propositions, and a decisive, low-friction CTA.

FRAMEWORKS REQUIRED:
- Copy 1: PAS (Problem - Agitation - Solution) Framework
  * Problem: Pinpoint an exact, irritating friction point mentioned or implied in customer reviews.
  * Agitation: Highlight the hidden frustration, wasted time, or cost of bad alternatives.
  * Solution: Present the product as the obvious, effortless fix. End with a clear call to action and pricing incentive.
- Copy 2: AIDA (Attention - Interest - Desire - Action) Framework
  * Attention: An arrestingly specific scroll-stopping hook (call out the audience or an absurd reality).
  * Interest: An intriguing, unique mechanism or praised feature from reviews that builds genuine curiosity.
  * Desire: A concrete before-and-after transformation (what daily life feels like with this product).
  * Action: A low-friction, decisive CTA with social proof and risk-reversal (guarantee, fast shipping).
- Copy 3: Story-Driven & Social Proof Framework
  * Open from a relatable customer perspective or narrative quoting or echoing the reviews ("I was skeptical about buying this at first...").
  * Overcome natural objection/skepticism with authentic, grounded social proof.
  * Close with urgency or limited promotional availability.

AUDIENCE, KEYWORDS & CUSTOMER REVIEWS:
- "targetAudience": 3 ultra-targeted demographic & interest segments ready to paste into Meta Ads Manager (include age ranges, specific Facebook interest categories, and buying behaviors).
- "keywords": 5 high-intent commercial search keywords and niche hashtags.
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
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });

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
        // Ensure customerReviews is populated or fallback to product reviews
        if (!parsed.customerReviews || parsed.customerReviews.length === 0) {
          parsed.customerReviews = productData.reviews ? productData.reviews.slice(0, 6) : [];
        }
        this.logger.log('Successfully generated and parsed marketing data from Gemini API.');
        return parsed;
      }

      throw new Error('Parsed response does not match expected interface');
    } catch (error: any) {
      this.logger.warn(
        `Gemini API generation failed or returned invalid response (${error.message}). Falling back to direct-response fallback generator.`,
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
   * High-converting fallback copy generator built on proven PAS, AIDA, and Story frameworks.
   */
  private generateFallbackMarketingData(product: ScrapedProduct): MarketingData {
    const titleSnippet = product.title.slice(0, 48).trim();
    const priceText = product.price || '$19.99';
    const reviews =
      product.reviews && product.reviews.length > 0
        ? product.reviews
        : [
            {
              author: 'Marcus K.',
              rating: 5,
              text: `Honestly exceeded my expectations. The build quality of this ${titleSnippet.slice(0, 24)} feels solid, nothing cheap or flimsy about it. Shipped fast and worked immediately.`,
              date: 'Verified Buyer · 4 days ago',
              country: 'US',
              highlight: 'Premium Build Quality',
            },
            {
              author: 'Elena S.',
              rating: 5,
              text: `Saw this trending on TikTok and decided to give it a shot. Completely replaced my older setup and saves me time every single day. 10/10 purchase!`,
              date: 'Verified Buyer · 1 week ago',
              country: 'UK',
              highlight: 'Time Saver & Sleek Design',
            },
            {
              author: 'David R.',
              rating: 5,
              text: `I was skeptical given the price, but after 3 weeks of daily use, it has been flawless. Customer service was responsive and tracking was updated daily.`,
              date: 'Verified Buyer · 2 weeks ago',
              country: 'CA',
              highlight: 'Unbeatable Value',
            },
            {
              author: 'Sarah M.',
              rating: 5,
              text: `Super intuitive and aesthetically pleasing. Fits perfectly with my minimalist desk aesthetic. Bought a second one as a gift for my brother!`,
              date: 'Verified Buyer · 2 weeks ago',
              country: 'AU',
              highlight: 'Minimalist Aesthetic',
            },
          ];

    return {
      facebookAdCopies: [
        // Framework 1: PAS (Problem - Agitation - Solution)
        `Stop wasting time dealing with poorly made alternatives that break after two weeks.\n\nMost options on the market cut corners on build quality, leaving you frustrated, out of pocket, and back at square one.\n\nThe new ${titleSnippet} was engineered to fix that once and for all. Built with premium-grade materials and tested for daily heavy use, it delivers reliable performance every single time.\n\n👉 Current Batch: Only ${priceText} (Special Launch Pricing)\n📦 Tracked worldwide shipping + 30-day trial guarantee.\n\nTap "Shop Now" to secure yours before this production run sells out.`,

        // Framework 2: AIDA (Attention - Interest - Desire - Action)
        `Notice how most products look great in pictures, but feel cheap the second you unbox them?\n\nHere is what makes ${titleSnippet} different: precision engineering and zero cut corners. Designed for peak utility without the ridiculous brand markup.\n\nImagine having a dependable setup that just works, saves you hours every week, and looks ultra-clean on your counter.\n\n🔥 Flash Price: ${priceText} (Save 40% Today)\n✅ 30-Day Money-Back Guarantee\n\nClick below to grab yours today with free priority shipping!`,

        // Framework 3: Story-Driven & Social Proof
        `"To be completely honest, I thought this was just another overhyped online product... until mine arrived."\n\nOver 8,400+ verified customers made the switch to the ${titleSnippet} this month alone. The consensus? It replaces three different clunky gadgets and does the job in half the time.\n\nNo gimmicks. Just solid durability, seamless functionality, and real everyday value.\n\n⭐ Rated 4.9/5 by verified buyers\n🏷️ Starting at ${priceText} while inventory lasts.\n\nClaim your discount before stock is claimed for the season! 👇`,
      ],
      targetAudience: [
        'High-Intent Online Shoppers (Ages 25-45, interested in smart living, productivity gadgets, and verified Shopify/Amazon bestsellers)',
        'Tech & Home Upgrade Enthusiasts (Ages 28-54, engaged shoppers targeting premium aesthetics, minimalist lifestyle, and durable tools)',
        'Impulse Direct-Response Buyers (Ages 21-39, frequent social shoppers on Instagram/TikTok looking for high utility problem-solvers)',
      ],
      keywords: [
        '#smartfinds',
        '#dailyessentials',
        '#practicalgadgets',
        '#homeupgrades',
        '#viraldeals',
      ],
      customerReviews: reviews.slice(0, 6),
    };
  }
}
