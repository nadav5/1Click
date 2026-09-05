import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { CampaignResponse } from '../models/campaign.model';

@Injectable({
  providedIn: 'root',
})
export class CampaignService {
  /**
   * Base URL for the live Render backend service.
   */
  readonly baseUrl = 'https://oneclick-z20t.onrender.com';

  /**
   * API endpoint for 1-click campaign generation.
   */
  readonly apiUrl = `${this.baseUrl}/api/campaign/generate`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Initiates the 1-Click marketing campaign generation pipeline.
   * Scrapes product details, triggers Gemini AI marketing generation,
   * resizes images with Sharp (1080x1080), and stitches a 10s MP4 promo video with FFmpeg.
   *
   * @param url AliExpress product page URL
   * @returns Observable containing the complete campaign assets with normalized static URLs
   */
  generateCampaign(url: string): Observable<CampaignResponse> {
    return this.http
      .post<CampaignResponse>(this.apiUrl, { url: url.trim() })
      .pipe(
        map((response: CampaignResponse) => this.normalizeMediaUrls(response)),
        catchError((error: HttpErrorResponse) => {
          let errorMessage = 'An unexpected error occurred while generating the campaign.';
          if (error.error && error.error.message) {
            errorMessage = Array.isArray(error.error.message)
              ? error.error.message.join(', ')
              : error.error.message;
          } else if (typeof error.error === 'string' && error.error.trim().length > 0) {
            errorMessage = error.error;
          } else if (error.status === 400 || error.status === 422) {
            errorMessage = 'Could not extract product data from this link. Please verify the URL.';
          } else if (error.status === 0) {
            errorMessage =
              `Cannot connect to backend service at ${this.baseUrl}. Please verify the Render service is running or check your network connection.`;
          } else if (error.statusText) {
            errorMessage = `Backend error (${error.status}): ${error.statusText}`;
          }
          return throwError(() => new Error(errorMessage));
        }),
      );
  }

  /**
   * Ensures that static asset URLs (images/video) prepend the Render backend base URL
   * if they are returned as relative paths, or replace obsolete localhost references.
   *
   * @param response Raw CampaignResponse from the backend
   * @returns CampaignResponse with normalized media URLs
   */
  private normalizeMediaUrls(response: CampaignResponse): CampaignResponse {
    if (!response || !response.media) {
      return response;
    }

    if (Array.isArray(response.media.images)) {
      response.media.images = response.media.images.map((img) => this.resolveAssetUrl(img));
    }

    if (response.media.videoUrl) {
      response.media.videoUrl = this.resolveAssetUrl(response.media.videoUrl);
    }

    return response;
  }

  /**
   * Normalizes an individual asset URL.
   * Prepends the baseUrl if the path is relative, or replaces localhost:3000 if returned by local backend.
   *
   * @param assetUrl Relative path or full URL
   * @returns Absolute URL pointing to the live Render backend
   */
  private resolveAssetUrl(assetUrl: string): string {
    if (!assetUrl) return assetUrl;

    // Handle localhost fallback if backend returned localhost:3000
    if (assetUrl.startsWith('http://localhost:3000')) {
      return assetUrl.replace('http://localhost:3000', this.baseUrl);
    }

    // Handle relative path with leading slash
    if (assetUrl.startsWith('/')) {
      return `${this.baseUrl}${assetUrl}`;
    }

    // If already absolute URL (e.g. http://, https://, data:), keep as-is
    if (/^https?:\/\//i.test(assetUrl) || assetUrl.startsWith('data:')) {
      return assetUrl;
    }

    // Relative path without leading slash
    return `${this.baseUrl}/${assetUrl}`;
  }
}
