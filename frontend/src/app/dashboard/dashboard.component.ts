import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { CampaignService } from '../services/campaign.service';
import {
  CampaignResponse,
  AnalyzeTextResponse,
  GenerateMediaResponse,
  ProductReview,
} from '../models/campaign.model';

export interface AdFrameworkMeta {
  badge: string;
  badgeClass: string;
  name: string;
  subtitle: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnDestroy {
  /**
   * Navigation state.
   */
  activeNav: string = 'campaign-builder';
  isSidebarOpen: boolean = false;

  readonly navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'campaign-builder', label: 'Campaign Builder', icon: 'wand', badge: 'Active' },
    { id: 'products', label: 'Product Scraper', icon: 'package' },
    { id: 'media-studio', label: 'Media Studio', icon: 'photo' },
    { id: 'analytics', label: 'Ad Analytics', icon: 'chart' },
  ];

  /**
   * Input model for the AliExpress product URL (empty by default for user input).
   */
  productUrl: string = '';

  /**
   * Progressive UI processing and loading states.
   */
  isTextLoading: boolean = false;
  isMediaLoading: boolean = false;
  loadingStep: string = '';
  errorMessage: string | null = null;
  mediaErrorMessage: string | null = null;

  /**
   * Combined loading state for button disabling.
   */
  get isLoading(): boolean {
    return this.isTextLoading || this.isMediaLoading;
  }

  /**
   * Timers for progressive step updates.
   */
  private stepTimers: any[] = [];

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
  copiedReviewIndex: number | null = null;

  /**
   * Metadata for the 3 direct-response ad frameworks.
   */
  readonly frameworkMeta: AdFrameworkMeta[] = [
    {
      badge: 'PAS Framework',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      name: 'Problem · Agitation · Solution',
      subtitle: 'Pins down daily friction and presents the product as the effortless fix.',
    },
    {
      badge: 'AIDA Framework',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
      name: 'Attention · Interest · Desire · Action',
      subtitle: 'Scroll-stopping hook, builds intense curiosity and sparks decisive action.',
    },
    {
      badge: 'Story & Social Proof',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      name: 'Customer Narrative & Trust',
      subtitle: 'Relatable scenario that overcomes buyer skepticism with social proof.',
    },
  ];

  /**
   * Enterprise-grade, non-intrusive SweetAlert2 toast notification configuration.
   */
  private readonly Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2400,
    timerProgressBar: false,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    },
    customClass: {
      popup: 'border border-slate-200/90 shadow-lg rounded-xl bg-white text-slate-800 text-xs font-sans p-3.5',
      title: 'text-xs font-semibold text-slate-900',
    },
  });

  constructor(
    private readonly campaignService: CampaignService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.clearTimers();
  }

  /**
   * Switch active sidebar navigation tab.
   */
  selectNav(navId: string): void {
    this.activeNav = navId;
    this.isSidebarOpen = false;
    if (navId !== 'campaign-builder') {
      const item = this.navItems.find((n) => n.id === navId);
      this.Toast.fire({
        icon: 'info',
        title: `${item?.label || 'Module'} selected`,
      });
    }
  }

  /**
   * Toggle sidebar on mobile devices.
   */
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  /**
   * Submits the AliExpress URL with progressive two-stage loading:
   * Stage 1: Fast text generation (Scraping + Gemini AI copy & targeting). Rendered immediately!
   * Stage 2: Asynchronous media generation (Pollinations AI lifestyle images + FFmpeg 10s video).
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

    // Clean previous state completely
    this.clearTimers();
    this.resetCopiedStates();
    this.campaignResult = null;
    this.errorMessage = null;
    this.mediaErrorMessage = null;
    this.isTextLoading = true;
    this.isMediaLoading = false;
    this.loadingStep = 'Connecting to AliExpress & extracting product data...';

    // Step updates for Stage 1 text analysis
    this.stepTimers.push(
      setTimeout(() => {
        if (this.isTextLoading) this.loadingStep = 'Extracting product specs, pricing, and buyer reviews...';
      }, 2500),
    );

    this.stepTimers.push(
      setTimeout(() => {
        if (this.isTextLoading) this.loadingStep = 'Prompting Gemini with PAS, AIDA & Story direct-response frameworks...';
      }, 5500),
    );

    // Stage 1: Fast Text Analysis
    this.campaignService.analyzeText(this.productUrl).subscribe({
      next: (textResponse: AnalyzeTextResponse) => {
        this.clearTimers();
        this.isTextLoading = false;
        this.loadingStep = '';

        // Immediately populate marketing copy, product specs, and customer reviews!
        this.campaignResult = {
          success: true,
          productId: textResponse.productId,
          product: textResponse.product,
          marketing: textResponse.marketing,
          media: {
            images: [],
            videoUrl: '',
          },
          timestamp: textResponse.timestamp,
        };

        const shortTitle = textResponse.product.title
          ? textResponse.product.title.slice(0, 32)
          : 'Product';

        this.Toast.fire({
          icon: 'success',
          title: `Copy ready for "${shortTitle}..."! Crafting media...`,
        });

        // Stage 2: Asynchronous AI Lifestyle Media & Video Generation
        this.isMediaLoading = true;
        this.cdr.detectChanges();

        this.campaignService
          .generateMedia({
            productId: textResponse.productId,
            title: textResponse.product.title,
            description: textResponse.product.description,
            price: textResponse.product.price,
            imageUrls: textResponse.product.imageUrls,
          })
          .subscribe({
            next: (mediaResponse: GenerateMediaResponse) => {
              this.isMediaLoading = false;
              if (this.campaignResult) {
                this.campaignResult.media = mediaResponse.media;
              }
              this.cdr.detectChanges();

              this.Toast.fire({
                icon: 'success',
                title: 'AI lifestyle images & promo video generated!',
              });
            },
            error: (mediaErr: Error) => {
              this.loggerWarn(mediaErr);
              this.isMediaLoading = false;
              this.mediaErrorMessage = mediaErr.message || 'Media generation encountered an issue.';
              this.cdr.detectChanges();

              this.Toast.fire({
                icon: 'warning',
                title: 'Media generation delayed or failed.',
              });
            },
          });
      },
      error: (err: Error) => {
        this.clearTimers();
        this.campaignResult = null;
        this.errorMessage = err.message || 'Could not extract product data from this link. Please verify the URL.';
        this.isTextLoading = false;
        this.isMediaLoading = false;
        this.loadingStep = '';
        this.cdr.detectChanges();

        this.Toast.fire({
          icon: 'error',
          title: this.errorMessage,
        });
      },
    });
  }

  private loggerWarn(err: any): void {
    console.warn('[Dashboard] Media generation error:', err);
  }

  /**
   * Resets all copy-to-clipboard flags.
   */
  private resetCopiedStates(): void {
    this.copiedAdIndex = null;
    this.copiedKeyword = null;
    this.copiedAudienceIndex = null;
    this.copiedReviewIndex = null;
  }

  /**
   * Clears all pending progressive loading timers.
   */
  private clearTimers(): void {
    for (const timer of this.stepTimers) {
      clearTimeout(timer);
    }
    this.stepTimers = [];
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

  /**
   * Helper to retrieve verified reviews from marketing response or scraped product.
   */
  get reviewsList(): ProductReview[] {
    if (!this.campaignResult) return [];
    if (
      this.campaignResult.marketing.customerReviews &&
      this.campaignResult.marketing.customerReviews.length > 0
    ) {
      return this.campaignResult.marketing.customerReviews;
    }
    return this.campaignResult.product.reviews || [];
  }

  /**
   * Copies a customer review quote to clipboard.
   */
  async copyReview(review: ProductReview, index: number): Promise<void> {
    try {
      const quoteText = `"${review.text}" - ${review.author}`;
      await navigator.clipboard.writeText(quoteText);
      this.copiedReviewIndex = index;

      this.Toast.fire({
        icon: 'success',
        title: `Customer review quote copied`,
      });

      setTimeout(() => {
        this.copiedReviewIndex = null;
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
