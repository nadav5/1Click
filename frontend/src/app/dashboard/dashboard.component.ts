import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { CampaignService } from '../services/campaign.service';
import { CampaignResponse } from '../models/campaign.model';

export interface AdFrameworkMeta {
  badge: string;
  badgeClass: string;
  name: string;
  subtitle: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  /**
   * Input model for the AliExpress product URL.
   */
  productUrl: string = 'https://www.aliexpress.com/item/1005006123456789.html';

  /**
   * UI processing and loading states.
   */
  isLoading: boolean = false;
  loadingStep: string = '';
  errorMessage: string | null = null;

  /**
   * The generated campaign response containing product, AI copy, and media assets.
   */
  campaignResult: CampaignResponse | null = null;

  /**
   * Tracks copy-to-clipboard actions for UI feedback.
   */
  copiedAdIndex: number | null = null;
  copiedKeyword: string | null = null;
  copiedAudienceIndex: number | null = null;

  /**
   * Metadata for the 3 direct-response ad frameworks.
   */
  readonly frameworkMeta: AdFrameworkMeta[] = [
    {
      badge: 'PAS Framework',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      name: 'Problem · Agitation · Solution',
      subtitle: 'Pins down daily friction and presents the product as the effortless fix.',
    },
    {
      badge: 'AIDA Framework',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      name: 'Attention · Interest · Desire · Action',
      subtitle: 'Scroll-stopping hook, builds intense curiosity and sparks decisive action.',
    },
    {
      badge: 'Story & Social Proof',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      name: 'Customer Narrative & Trust',
      subtitle: 'Relatable scenario that overcomes buyer skepticism with social proof.',
    },
  ];

  /**
   * Sample products for quick testing.
   */
  readonly sampleUrls = [
    {
      label: 'Smart Wireless Desk Lamp',
      url: 'https://www.aliexpress.com/item/1005006123456789.html',
    },
    {
      label: 'Magnetic ANC Earbuds',
      url: 'https://www.aliexpress.com/item/1005005987654321.html',
    },
    {
      label: 'RGB Floating Speaker',
      url: 'https://www.aliexpress.com/item/1005004112233445.html',
    },
  ];

  /**
   * Enterprise-grade, non-intrusive SweetAlert2 toast notification configuration.
   */
  private readonly Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: false,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
    customClass: {
      popup: 'border border-slate-200/90 shadow-md rounded-xl bg-white text-slate-800 text-xs font-sans p-3.5',
      title: 'text-xs font-semibold text-slate-900',
    },
  });

  constructor(
    private readonly campaignService: CampaignService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  /**
   * Populates the input field with a demo URL.
   */
  setSampleUrl(url: string): void {
    this.productUrl = url;
    this.errorMessage = null;
  }

  /**
   * Submits the AliExpress URL to trigger the full 1-Click campaign generation pipeline:
   * 1. Puppeteer scraping
   * 2. Gemini direct-response AI generation
   * 3. Sharp 1080x1080 resizing & FFmpeg 10s video generation
   */
  onGenerate(): void {
    if (!this.productUrl || !this.productUrl.trim()) {
      this.errorMessage = 'Please enter a valid AliExpress product URL.';
      this.Toast.fire({
        icon: 'warning',
        title: 'Please enter a valid product URL',
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.campaignResult = null;
    this.loadingStep = 'Initializing browser & launching Puppeteer crawler...';

    // Progressive step updates to provide transparent feedback during generation
    const stepTimer1 = setTimeout(() => {
      if (this.isLoading) this.loadingStep = 'Extracting product specs, pricing, and high-res gallery...';
    }, 2500);

    const stepTimer2 = setTimeout(() => {
      if (this.isLoading) this.loadingStep = 'Generating PAS, AIDA & Story copy with Gemini...';
    }, 5500);

    const stepTimer3 = setTimeout(() => {
      if (this.isLoading) this.loadingStep = 'Sharp 1080x1080 asset styling & FFmpeg video rendering...';
    }, 9500);

    this.campaignService.generateCampaign(this.productUrl).subscribe({
      next: (response: CampaignResponse) => {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);
        this.campaignResult = response;
        this.isLoading = false;
        this.loadingStep = '';
        this.cdr.detectChanges();

        this.Toast.fire({
          icon: 'success',
          title: 'Campaign assets generated successfully',
        });
      },
      error: (err: Error) => {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);
        this.errorMessage = err.message;
        this.isLoading = false;
        this.loadingStep = '';
        this.cdr.detectChanges();

        this.Toast.fire({
          icon: 'error',
          title: 'Generation failed. Using resilient fallback.',
        });
      },
    });
  }

  /**
   * Copies Facebook ad copy to clipboard with SweetAlert2 toast confirmation.
   */
  async copyAdCopy(copy: string, index: number, frameworkName: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(copy);
      this.copiedAdIndex = index;

      this.Toast.fire({
        icon: 'success',
        title: `${frameworkName} copy saved to clipboard`,
      });

      setTimeout(() => {
        this.copiedAdIndex = null;
        this.cdr.detectChanges();
      }, 2000);
    } catch {
      this.Toast.fire({
        icon: 'error',
        title: 'Failed to write to clipboard',
      });
    }
  }

  /**
   * Copies a keyword tag to clipboard with SweetAlert2 toast confirmation.
   */
  async copyKeyword(keyword: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(keyword);
      this.copiedKeyword = keyword;

      this.Toast.fire({
        icon: 'success',
        title: `Keyword copied: ${keyword}`,
      });

      setTimeout(() => {
        this.copiedKeyword = null;
        this.cdr.detectChanges();
      }, 1500);
    } catch {
      this.Toast.fire({
        icon: 'error',
        title: 'Failed to write to clipboard',
      });
    }
  }

  /**
   * Copies an audience segment string to clipboard.
   */
  async copyAudience(audience: string, index: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(audience);
      this.copiedAudienceIndex = index;

      this.Toast.fire({
        icon: 'success',
        title: `Audience segment #${index + 1} copied`,
      });

      setTimeout(() => {
        this.copiedAudienceIndex = null;
        this.cdr.detectChanges();
      }, 1500);
    } catch {
      this.Toast.fire({
        icon: 'error',
        title: 'Failed to write to clipboard',
      });
    }
  }
}
