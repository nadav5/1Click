import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { CampaignResponse } from '../models/campaign.model';

@Injectable({
  providedIn: 'root',
})
export class CampaignService {
  /**
   * Base API URL pointing to the NestJS Campaign backend.
   */
  private readonly apiUrl = 'http://localhost:3000/api/campaign/generate';

  constructor(private readonly http: HttpClient) {}

  /**
   * Initiates the 1-Click marketing campaign generation pipeline.
   * Scrapes product details, triggers Gemini AI marketing generation,
   * resizes images with Sharp (1080x1080), and stitches a 10s MP4 promo video with FFmpeg.
   *
   * @param url AliExpress product page URL
   * @returns Observable containing the complete campaign assets
   */
  generateCampaign(url: string): Observable<CampaignResponse> {
    return this.http
      .post<CampaignResponse>(this.apiUrl, { url: url.trim() })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          let errorMessage = 'An unexpected error occurred while generating the campaign.';
          if (error.error && error.error.message) {
            errorMessage = Array.isArray(error.error.message)
              ? error.error.message.join(', ')
              : error.error.message;
          } else if (error.status === 0) {
            errorMessage =
              'Cannot connect to backend service at http://localhost:3000. Please ensure the NestJS backend is running.';
          } else if (error.statusText) {
            errorMessage = `Backend error (${error.status}): ${error.statusText}`;
          }
          return throwError(() => new Error(errorMessage));
        }),
      );
  }
}
