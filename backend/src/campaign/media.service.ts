import { Injectable, Logger } from '@nestjs/common';
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
   * Downloads product images, resizes them with Sharp to 1080x1080,
   * and stitches them into a 10-second promotional slideshow video using FFmpeg.
   *
   * @param imageUrls List of scraped image URLs
   * @param productId Unique identifier for product
   * @returns MediaAssets with local paths and public URLs
   */
  async processMedia(imageUrls: string[], productId: string): Promise<MediaAssets> {
    this.logger.log(`Processing media assets for product ${productId}...`);

    // Define storage directory: backend/temp/products/{productId}
    const tempBaseDir = path.join(process.cwd(), 'temp', 'products', productId);
    if (!fs.existsSync(tempBaseDir)) {
      fs.mkdirSync(tempBaseDir, { recursive: true });
    }

    // Ensure we have at least 4 image candidates
    const selectedUrls = this.prepareImageUrlList(imageUrls);

    // Download and resize images to 1080x1080 square format
    const localImagePaths: string[] = [];
    const publicImageUrls: string[] = [];

    for (let i = 0; i < 4; i++) {
      const filename = `image_${i}.jpg`;
      const outputPath = path.join(tempBaseDir, filename);

      try {
        await this.downloadAndResizeImage(selectedUrls[i], outputPath, i);
      } catch (err: any) {
        this.logger.warn(
          `Failed to process image #${i} (${selectedUrls[i]}): ${err.message}. Generating placeholder card.`,
        );
        await this.generatePlaceholderImage(outputPath, i + 1);
      }

      localImagePaths.push(outputPath);
      // Accessible via static asset route: /temp/products/{productId}/{filename}
      publicImageUrls.push(`${this.baseUrl}/temp/products/${productId}/${filename}`);
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
   * Ensures the list contains at least 4 valid URLs.
   * If valid scraped product URLs exist, cycle them so the user sees the real product across all 4 frames.
   */
  private prepareImageUrlList(urls: string[]): string[] {
    const valid = urls.filter((u) => u && typeof u === 'string');
    if (valid.length >= 4) return valid.slice(0, 4);

    if (valid.length > 0) {
      const result = [...valid];
      while (result.length < 4) {
        result.push(valid[result.length % valid.length]);
      }
      return result;
    }

    // High quality neutral e-commerce studio photography if zero URLs were passed
    const neutralFallbacks = [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1080&q=80',
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1080&q=80',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1080&q=80',
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1080&q=80',
    ];

    return neutralFallbacks;
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
