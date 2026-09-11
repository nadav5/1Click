import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import {
  CampaignResponse,
  AnalyzeTextResponse,
  GenerateMediaResponse,
  GenerateMediaPayload,
  MediaAssets,
} from '../models/campaign.model';

@Injectable({
  providedIn: 'root',
})
export class CampaignService {
  /**
   * Base URL: routes to localhost:3000 during local dev, and Render in production.
   */
  get baseUrl(): string {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return 'http://localhost:3000';
    }
    return 'https://oneclick-z20t.onrender.com';
  }

  /**
   * API endpoints.
   */
  get apiUrl(): string { return `${this.baseUrl}/api/campaign/generate`; }
  get analyzeTextUrl(): string { return `${this.baseUrl}/api/campaign/analyze-text`; }
  get generateMediaUrl(): string { return `${this.baseUrl}/api/campaign/generate-media`; }

  constructor(private readonly http: HttpClient) {}

  /**
   * Step 1: Initiates fast product scraping & Gemini text generation.
   *
   * @param url AliExpress product page URL
   * @returns Observable of AnalyzeTextResponse with product details & marketing copy
   */
  analyzeText(url: string): Observable<AnalyzeTextResponse> {
    return this.http
      .post<AnalyzeTextResponse>(this.analyzeTextUrl, { url: url.trim() })
      .pipe(catchError((error: HttpErrorResponse) => this.handleHttpError(error)));
  }

  /**
   * Step 2: Generates lifestyle AI images (Pollinations.ai) and compiles 10s promo video.
   *
   * @param payload Payload containing productId, title, description, and scraped imageUrls
   * @returns Observable of GenerateMediaResponse with normalized media URLs
   */
  generateMedia(payload: GenerateMediaPayload): Observable<GenerateMediaResponse> {
    return this.http
      .post<GenerateMediaResponse>(this.generateMediaUrl, payload)
      .pipe(
        map((response: GenerateMediaResponse) => this.normalizeGenerateMediaResponse(response)),
        catchError((error: HttpErrorResponse) => this.handleHttpError(error)),
      );
  }

  /**
   * Initiates the unified 1-Click marketing campaign generation pipeline (backwards compatible).
   *
   * @param url AliExpress product page URL
   * @returns Observable containing the complete campaign assets with normalized static URLs
   */
  generateCampaign(url: string): Observable<CampaignResponse> {
    return this.http
      .post<CampaignResponse>(this.apiUrl, { url: url.trim() })
      .pipe(
        map((response: CampaignResponse) => this.normalizeMediaUrls(response)),
        catchError((error: HttpErrorResponse) => this.handleHttpError(error)),
      );
  }

  /**
   * Centralized HTTP error handler with user-friendly error formatting.
   */
  private handleHttpError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred while processing the request.';
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
  }

  /**
   * Normalizes media URLs for CampaignResponse.
   */
  private normalizeMediaUrls(response: CampaignResponse): CampaignResponse {
    if (response?.media) {
      response.media = this.normalizeMediaAssets(response.media);
    }
    return response;
  }

  /**
   * Normalizes media URLs for GenerateMediaResponse.
   */
  private normalizeGenerateMediaResponse(response: GenerateMediaResponse): GenerateMediaResponse {
    if (response?.media) {
      response.media = this.normalizeMediaAssets(response.media);
    }
    return response;
  }

  /**
   * Normalizes the MediaAssets object.
   */
  private normalizeMediaAssets(media: MediaAssets): MediaAssets {
    if (!media) return media;

    if (Array.isArray(media.images)) {
      media.images = media.images.map((img) => this.resolveAssetUrl(img));
    }

    if (media.videoUrl) {
      media.videoUrl = this.resolveAssetUrl(media.videoUrl);
    }

    return media;
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
