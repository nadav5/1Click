import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { removeBackground } from '@imgly/background-removal-node';
import { MediaAssets } from './campaign.interface.js';

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.configureFfmpeg();
  }

  /**
   * Configures FFmpeg binary path if installed in common paths or winget.
   */
  private configureFfmpeg(): void {
    const customFfmpegPath = process.env.FFMPEG_PATH;
    if (customFfmpegPath && fs.existsSync(customFfmpegPath)) {
      ffmpeg.setFfmpegPath(customFfmpegPath);
      this.logger.log(`FFmpeg path explicitly configured from env: ${customFfmpegPath}`);
      return;
    }

    // Default winget path on current system
    const wingetFfmpeg =
      'C:\\Users\\nadav\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffmpeg.exe';
    if (fs.existsSync(wingetFfmpeg)) {
      ffmpeg.setFfmpegPath(wingetFfmpeg);
      this.logger.log(`FFmpeg path set to winget build: ${wingetFfmpeg}`);
    }
  }

  /**
   * Helper sleep function to pause execution for rate-limiting and retries.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Smart Composite Media Pipeline:
   * 1. Takes the first high-quality scraped product image and removes background via @imgly/background-removal-node.
   * 2. Generates 4 clean, empty commercial backgrounds via Pollinations AI.
   * 3. Uses Sharp to composite the isolated product PNG directly in the center of the backgrounds.
   * 4. Stitches the composited images into a 10s MP4 promo video with FFmpeg.
   * 5. If imgly fails or times out, safely falls back to original scraped images.
   *
   * @param imageUrls List of scraped image URLs
   * @param productId Unique identifier for product
   * @param title Product title for contextual AI prompts
   * @param description Product description for contextual AI prompts
   * @returns MediaAssets with local paths and public URLs
   */
  async processMedia(
    imageUrls: string[],
    productId: string,
    title?: string,
    description?: string,
  ): Promise<MediaAssets> {
    this.logger.log(`Processing media assets for product ${productId}...`);

    // Define storage directory: backend/temp/products/{productId}
    const tempBaseDir = path.join(process.cwd(), 'temp', 'products', productId);
    if (!fs.existsSync(tempBaseDir)) {
      fs.mkdirSync(tempBaseDir, { recursive: true });
    }

    const selectedScrapedUrls = this.prepareImageUrlList(imageUrls);
    const primaryScrapedUrl = selectedScrapedUrls[0];

    // Step 1: Isolate Product using @imgly/background-removal-node
    let transparentProductBuffer: Buffer | null = null;
    if (primaryScrapedUrl) {
      try {
        this.logger.log(`[Smart Composite] Downloading scraped product image: ${primaryScrapedUrl}`);
        const rawImageBuffer = await this.downloadImageBuffer(primaryScrapedUrl);

        this.logger.log(`[Smart Composite] Removing background with @imgly/background-removal-node...`);
        const imageBlob = new Blob([new Uint8Array(rawImageBuffer)], { type: 'image/jpeg' });
        const cutoutBlob = await this.removeBackgroundWithTimeout(imageBlob, 30000);
        const cutoutArrayBuffer = await cutoutBlob.arrayBuffer();
        transparentProductBuffer = Buffer.from(cutoutArrayBuffer);
        this.logger.log(
          `[Smart Composite] Successfully isolated product cutout (${transparentProductBuffer.length} bytes).`,
        );
      } catch (bgErr: any) {
        this.logger.warn(
          `[Smart Composite] Background removal failed or timed out: ${bgErr.message}. Safely falling back to original scraped images.`,
        );
        transparentProductBuffer = null;
      }
    }

    // Step 2: Pure empty background prompts for Pollinations AI (no people, no text, empty center)
    const backgroundPrompts = [
      'Commercial product advertisement background, modern minimal aesthetic desk setup, blurred background, empty space in the middle, no people, no text, photorealistic, 8k',
      'Luxury product photoshoot background, sleek modern marble countertop, subtle warm ambient lighting, empty space in center, soft cinematic bokeh, clean minimalist aesthetic, no people, no text, 8k',
      'Minimalist lifestyle podium background, smooth pastel gradient podium, architectural geometry, soft studio shadow, empty space in the middle, high-end commercial presentation, no people, no text, 8k',
      'Contemporary cozy living room tabletop background, natural oak wood surface, blurred modern interior background, clean empty center area, gentle golden hour daylight, no people, no text, photorealistic, 8k',
    ];

    const localImagePaths: string[] = [];
    const publicImageUrls: string[] = [];

    // Step 3: Process 4 media assets sequentially (Smart Composite or Scraped Fallback)
    for (let i = 0; i < 4; i++) {
      const filename = `image_${i}.jpg`;
      const outputPath = path.join(tempBaseDir, filename);

      let composited = false;

      // If transparent cutout is available, fetch empty background and composite with Sharp
      if (transparentProductBuffer) {
        if (i > 0) {
          this.logger.log(`Waiting 2500ms before requesting next Pollinations AI background...`);
          await this.sleep(2500);
        }

        try {
          const bgBuffer = await this.fetchPollinationsBackgroundBuffer(backgroundPrompts[i], i);
          await this.compositeProductOnBackground(transparentProductBuffer, bgBuffer, outputPath);
          composited = true;
          this.logger.log(`[Smart Composite #${i + 1}/4] Successfully created composited image.`);
        } catch (compositeErr: any) {
          this.logger.warn(
            `[Smart Composite #${i + 1}/4] Background composite failed (${compositeErr.message}). Falling back to scraped image.`,
          );
        }
      }

      // Safe fallback: If background removal failed or composite failed, use original scraped image
      if (!composited) {
        try {
          const fallbackUrl = selectedScrapedUrls[i] || selectedScrapedUrls[0];
          this.logger.log(`[Fallback #${i + 1}/4] Processing scraped image: ${fallbackUrl}`);
          await this.downloadAndResizeImage(fallbackUrl, outputPath, i);
        } catch (fallbackErr: any) {
          this.logger.warn(
            `[Fallback #${i + 1}/4] Scraped image download failed (${fallbackErr.message}). Generating placeholder image.`,
          );
          await this.generatePlaceholderImage(outputPath, i + 1);
        }
      }

      localImagePaths.push(outputPath);
      publicImageUrls.push(`${this.baseUrl}/temp/products/${productId}/${filename}`);
    }

    // Step 4: Generate 10-second slideshow video using the final composited images
    const videoFilename = 'promo_video.mp4';
    const localVideoPath = path.join(tempBaseDir, videoFilename);
    const publicVideoUrl = `${this.baseUrl}/temp/products/${productId}/${videoFilename}`;

    try {
      await this.generateSlideshowVideo(localImagePaths, localVideoPath);
      this.logger.log(`Promotional video successfully generated at: ${localVideoPath}`);
    } catch (videoError: any) {
      this.logger.error(`Error generating FFmpeg video: ${videoError.message}`);
      // If crossfade filter fails, fallback to simple concat slideshow
      await this.generateSimpleSlideshow(localImagePaths, localVideoPath);
    }

    return {
      images: publicImageUrls,
      videoUrl: publicVideoUrl,
      localImagePaths,
      localVideoPath,
    };
  }

  /**
   * Composites the transparent product PNG directly on top of the 1080x1080 background in the center.
   */
  private async compositeProductOnBackground(
    productPngBuffer: Buffer,
    backgroundBuffer: Buffer,
    outputPath: string,
  ): Promise<void> {
    // Scale product to fit comfortably within 720x720 inside 1080x1080 frame
    const resizedProduct = await sharp(productPngBuffer)
      .resize(720, 720, {
        fit: 'inside',
        withoutEnlargement: false,
      })
      .toBuffer();

    // Composite overlay onto background with center gravity
    await sharp(backgroundBuffer)
      .resize(1080, 1080, {
        fit: 'cover',
        position: 'center',
      })
      .composite([
        {
          input: resizedProduct,
          gravity: 'center',
        },
      ])
      .jpeg({ quality: 90 })
      .toFile(outputPath);
  }

  /**
   * Wraps removeBackground with a timeout promise to safely prevent hanging.
   */
  private async removeBackgroundWithTimeout(
    imageBlob: Blob,
    timeoutMs: number = 30000,
  ): Promise<Blob> {
    return Promise.race([
      removeBackground(imageBlob),
      new Promise<Blob>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Background removal timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Downloads an image URL as raw Buffer.
   */
  private async downloadImageBuffer(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    return Buffer.from(response.data);
  }

  /**
   * Fetches an empty background from Pollinations AI with retries, 60s timeout, and backoff.
   */
  private async fetchPollinationsBackgroundBuffer(
    prompt: string,
    imageIndex: number,
  ): Promise<Buffer> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(
          `[Media AI #${imageIndex + 1}/4] (Attempt ${attempt}/${maxAttempts}) Requesting background from Pollinations AI...`,
        );
        const encodedPrompt = encodeURIComponent(prompt);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&nologo=true`;

        const response = await axios.get(pollinationsUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        });

        if (response.status !== 200 || !response.data || response.data.length < 1000) {
          throw new Error(`Invalid response received from Pollinations AI (HTTP ${response.status})`);
        }

        return Buffer.from(response.data);
      } catch (err: any) {
        const statusCode = err.response?.status;
        let responseData = 'No response data';
        if (err.response?.data) {
          responseData = Buffer.isBuffer(err.response.data)
            ? err.response.data.toString('utf-8').slice(0, 500)
            : typeof err.response.data === 'object'
              ? JSON.stringify(err.response.data).slice(0, 500)
              : String(err.response.data).slice(0, 500);
        }

        const isTimeout =
          err.code === 'ECONNABORTED' ||
          (err.message && err.message.toLowerCase().includes('timeout'));
        const isRateLimitOrServerError =
          statusCode === 429 ||
          statusCode === 500 ||
          statusCode === 502 ||
          statusCode === 503 ||
          statusCode === 504 ||
          !statusCode;

        const isRetryable = isTimeout || isRateLimitOrServerError;

        if (attempt < maxAttempts && isRetryable) {
          const reason = isTimeout
            ? 'Timeout reached (60s)'
            : statusCode
              ? `HTTP ${statusCode}`
              : err.code || err.message;

          this.logger.warn(
            `Pollinations AI background #${imageIndex + 1} attempt ${attempt}/${maxAttempts} failed with ${reason}. Waiting 5000ms before retry. Response data: ${responseData}`,
          );
          await this.sleep(5000);
        } else {
          this.logger.error(
            `Pollinations AI background generation permanently failed for image #${imageIndex + 1} after ${attempt} attempts. HTTP Status Code: ${statusCode || 'N/A'}. Error Data: ${responseData}`,
            err.stack,
          );
          throw err;
        }
      }
    }
    throw new Error(`Failed to generate Pollinations AI background after ${maxAttempts} attempts`);
  }

  /**
   * Ensures the list contains at least 4 valid URLs by cycling available images.
   */
  private prepareImageUrlList(urls?: string[]): string[] {
    const valid = (urls || []).filter((u) => u && typeof u === 'string' && u.trim().length > 0);
    if (valid.length === 0) {
      return [];
    }

    const result = [...valid];
    while (result.length < 4) {
      result.push(valid[result.length % valid.length]);
    }
    return result.slice(0, 4);
  }

  /**
   * Downloads an image via Axios as arraybuffer and resizes to 1080x1080 using Sharp.
   */
  private async downloadAndResizeImage(
    url: string,
    outputPath: string,
    index: number,
  ): Promise<void> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    const buffer = Buffer.from(response.data);

    // Sharp pipeline: resize to 1080x1080, center crop, high-quality JPEG
    await sharp(buffer)
      .resize(1080, 1080, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);
  }

  /**
   * Generates a modern gradient card in case of image download failures.
   */
  private async generatePlaceholderImage(outputPath: string, index: number): Promise<void> {
    const gradients = [
      { r: 37, g: 99, b: 235 }, // Blue
      { r: 79, g: 70, b: 229 }, // Indigo
      { r: 147, g: 51, b: 234 }, // Purple
      { r: 13, g: 148, b: 136 }, // Teal
    ];
    const bg = gradients[(index - 1) % gradients.length];

    await sharp({
      create: {
        width: 1080,
        height: 1080,
        channels: 3,
        background: bg,
      },
    })
      .jpeg({ quality: 90 })
      .toFile(outputPath);
  }

  /**
   * Uses fluent-ffmpeg to stitch 4 images into a 10-second MP4 slideshow
   * with smooth crossfade transitions between slides.
   */
  private generateSlideshowVideo(imagePaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 4 images, each shown for ~3.2s, crossfade transition duration = 0.7s
      // Total duration = 4 * 3.2 - 3 * 0.7 = 12.8 - 2.1 = 10.7s (trimmed to exactly 10s via -t 10)
      const command = ffmpeg();

      imagePaths.forEach((imgPath) => {
        command.input(imgPath).loop(3.2).fps(25);
      });

      command
        .complexFilter(
          [
            '[0:v][1:v]xfade=transition=fade:duration=0.7:offset=2.5[v01]',
            '[v01][2:v]xfade=transition=fade:duration=0.7:offset=5.0[v02]',
            '[v02][3:v]xfade=transition=fade:duration=0.7:offset=7.5[v03]',
            '[v03]format=yuv420p[outv]',
          ],
          ['outv'],
        )
        .outputOptions([
          '-t 10',
          '-c:v libx264',
          '-preset ultrafast',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
        ])
        .output(outputPath)
        .on('end', () => {
          this.logger.log(`Slideshow video successfully created at ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(`FFmpeg slideshow generation error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Resilient fallback slideshow in case xfade filter is unsupported.
   */
  private generateSimpleSlideshow(imagePaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.log('Attempting simple fallback slideshow without crossfade...');
      // Create a concat text file
      const concatFilePath = path.join(path.dirname(outputPath), 'concat_list.txt');
      const lines = imagePaths.map((p) => `file '${p.replace(/\\/g, '/')}'\nduration 2.5`).join('\n');
      fs.writeFileSync(concatFilePath, lines);

      ffmpeg()
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-t 10'])
        .output(outputPath)
        .on('end', () => {
          if (fs.existsSync(concatFilePath)) fs.unlinkSync(concatFilePath);
          resolve();
        })
        .on('error', (err) => {
          if (fs.existsSync(concatFilePath)) fs.unlinkSync(concatFilePath);
          reject(err);
        })
        .run();
    });
  }
}
