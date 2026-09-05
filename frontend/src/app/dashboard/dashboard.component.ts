import { Component, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { CampaignService } from '../services/campaign.service';
import { CampaignResponse, ProductReview } from '../models/campaign.model';

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
   * Input model for the AliExpress product URL.
   */
  productUrl: string = 'https://www.aliexpress.com/item/1005006123456789-Magnetic-Wireless-Desk-Lamp.html';

  /**
   * UI processing and loading states.
   */
  isLoading: boolean = false;
  loadingStep: string = '';
  errorMessage: string | null = null;

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
   * Sample products for quick testing.
   */
  readonly sampleUrls = [
    {
      label: 'Smart Wireless Desk Lamp',
      url: 'https://www.aliexpress.com/item/1005006123456789-Magnetic-Wireless-Desk-Lamp.html',
    },
    {
      label: 'Portable Blender Juicer',
      url: 'https://www.aliexpress.com/item/1005005987654321-Portable-Blender-Juicer.html',
    },
    {
      label: 'Cordless Car Vacuum',
      url: 'https://www.aliexpress.com/item/1005004112233445-High-Power-Cordless-Car-Vacuum.html',
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
   * Populates the input field with a demo URL and cleans previous result state.
   */
  setSampleUrl(url: string): void {
    this.productUrl = url;
    this.errorMessage = null;
    this.campaignResult = null;
    this.resetCopiedStates();
  }

  /**
   * Submits the AliExpress URL to trigger the full 1-Click campaign generation pipeline:
   * 1. Multi-tier scraping (Axios HTTP + Puppeteer)
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

    // Clean previous state completely
    this.clearTimers();
    this.resetCopiedStates();
    this.campaignResult = null;
    this.errorMessage = null;
    this.isLoading = true;
    this.loadingStep = 'Connecting to AliExpress & extracting product data...';

    // Progressive step updates to provide transparent feedback during generation
    this.stepTimers.push(
      setTimeout(() => {
        if (this.isLoading) this.loadingStep = 'Extracting product specs, pricing, and high-res gallery...';
      }, 2500),
    );

    this.stepTimers.push(
      setTimeout(() => {
        if (this.isLoading) this.loadingStep = 'Prompting Gemini with PAS, AIDA & Story direct-response frameworks...';
      }, 5500),
    );

    this.stepTimers.push(
      setTimeout(() => {
        if (this.isLoading) this.loadingStep = 'Sharp 1080x1080 square framing & FFmpeg 10s crossfade video synthesis...';
      }, 9500),
    );

    this.campaignService.generateCampaign(this.productUrl).subscribe({
      next: (response: CampaignResponse) => {
        this.clearTimers();
        this.campaignResult = response;
        this.isLoading = false;
        this.loadingStep = '';
        this.cdr.detectChanges();

        const shortTitle = response.product.title
          ? response.product.title.slice(0, 32)
          : 'Product';

        this.Toast.fire({
          icon: 'success',
          title: `Campaign generated for "${shortTitle}..."`,
        });
      },
      error: (err: Error) => {
        this.clearTimers();
        this.campaignResult = null;
        this.errorMessage = err.message || 'Could not extract product data from this link. Please verify the URL.';
        this.isLoading = false;
        this.loadingStep = '';
        this.cdr.detectChanges();

        this.Toast.fire({
          icon: 'error',
          title: this.errorMessage,
        });
      },
    });
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
