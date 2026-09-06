import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
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
   * Generates lifestyle product images using Pollinations AI sequentially with rate limiting,
   * resizes them with Sharp to 1080x1080, and stitches them into a 10-second promotional slideshow video.
   *
   * If AI image generation fails after retries, throws an HttpException so the process halts.
   *
   * @param imageUrls List of scraped image URLs (retained in method signature)
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

    // Build 4 distinct lifestyle commercial photography prompts
    const cleanTitle = (title || 'trending modern product')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    const prompts = [
      `High-end commercial lifestyle photograph of ${cleanTitle} in a modern beautifully styled room, natural daylight, professional lighting, photorealistic, 8k, sharp focus`,
      `A person happily using ${cleanTitle} in an everyday modern lifestyle setting, photorealistic, soft warm ambient lighting, 8k, award winning commercial photography`,
      `Close-up cinematic product shot of ${cleanTitle} with elegant background and shallow depth of field, 8k resolution, crisp detail, commercial aesthetic`,
      `Minimalist studio advertisement for ${cleanTitle}, clean neutral background, perfect studio illumination, premium sleek product presentation, 8k`,
    ];

    const localImagePaths: string[] = [];
    const publicImageUrls: string[] = [];

    // Process Pollinations AI images sequentially with a for...of loop and 2.5s delay between requests
    let i = 0;
    for (const prompt of prompts) {
      if (i > 0) {
        this.logger.log(`Waiting 2500ms before requesting next Pollinations AI image to respect rate limits...`);
        await this.sleep(2500);
      }

      const filename = `image_${i}.jpg`;
      const outputPath = path.join(tempBaseDir, filename);

      // Fetch with retry logic; halts and throws HttpException if it permanently fails
      await this.fetchPollinationsImageWithRetry(prompt, outputPath, i);

      localImagePaths.push(outputPath);
      publicImageUrls.push(`${this.baseUrl}/temp/products/${productId}/${filename}`);
      i++;
    }

    // Generate 10-second slideshow video with crossfade transitions
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
   * Fetches a photorealistic AI lifestyle image from Pollinations.ai with retry logic.
   * If a timeout, 429, or 500 error is caught, logs a warning, waits 5000ms,
   * and retries fetching that specific image up to 3 total attempts.
   *
   * If it permanently fails after retries, logs the exact error response code and data,
   * then throws an HttpException(500).
   */
  private async fetchPollinationsImageWithRetry(
    prompt: string,
    outputPath: string,
    imageIndex: number,
  ): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(
          `[Media AI #${imageIndex + 1}/4] (Attempt ${attempt}/${maxAttempts}) Requesting image from Pollinations AI...`,
        );
        await this.fetchPollinationsImage(prompt, outputPath);
        this.logger.log(
          `[Media AI #${imageIndex + 1}/4] Successfully generated and processed lifestyle image.`,
        );
        return;
      } catch (err: any) {
        const statusCode = err.response?.status;
        let responseData = 'No response data';
        if (err.response?.data) {
          responseData = Buffer.isBuffer(err.response.data)
            ? err.response.data.toString('utf-8').slice(0, 1000)
            : typeof err.response.data === 'object'
              ? JSON.stringify(err.response.data).slice(0, 1000)
              : String(err.response.data).slice(0, 1000);
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
            `Pollinations AI image #${imageIndex + 1} attempt ${attempt}/${maxAttempts} failed with ${reason}. Waiting 5000ms before retry. Response data: ${responseData}`,
          );
          await this.sleep(5000);
        } else {
          this.logger.error(
            `Pollinations AI image generation permanently failed for image #${imageIndex + 1} after ${attempt} attempts. HTTP Status Code: ${statusCode || 'N/A'}. Error Data: ${responseData}`,
            err.stack,
          );
          throw new HttpException(
            `AI image generation failed on image #${imageIndex + 1} (HTTP ${statusCode || 500}): ${responseData || err.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
    }
  }

  /**
   * Fetches a photorealistic AI lifestyle image from Pollinations.ai and resizes to 1080x1080.
   */
  private async fetchPollinationsImage(prompt: string, outputPath: string): Promise<void> {
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

    const buffer = Buffer.from(response.data);

    await sharp(buffer)
      .resize(1080, 1080, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);
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
