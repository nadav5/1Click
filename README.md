# ? 1-Click to Campaign: Dropshipping Marketing SaaS (POC)

A high-performance Full-Stack POC that transforms any AliExpress product link into a complete marketing campaign in one click.

---

## ??? Architecture Overview

```
                        [User / Marketer]
                               ? (AliExpress Product URL)
                               ?
            ????????????????????????????????????????
            ?       Angular 22 + Tailwind CSS      ?
            ?     Modern SaaS Dashboard Component  ?
            ????????????????????????????????????????
                               ? POST /api/campaign/generate
                               ?
            ????????????????????????????????????????
            ?          NestJS 12 Backend           ?
            ?          (CampaignModule)            ?
            ????????????????????????????????????????
                   ?           ?           ?
       [1] Scrape  ?   [2] AI  ?   [3] Media Processing
                   ?           ?           ?
        ??????????????? ??????????????? ?????????????????????
        ?  Puppeteer  ? ?Google Gemini? ?  Axios + Sharp    ?
        ? DOM Crawler ? ?  1.5/2.5    ? ? (1080x1080 resize)?
        ??????????????? ??????????????? ?????????????????????
                                                  ?
                                                  ?
                                        ?????????????????????
                                        ?   fluent-ffmpeg   ?
                                        ?  (10s MP4 Video   ?
                                        ?  with Crossfade)  ?
                                        ?????????????????????
```

---

## ?? Key Features

### 1. Backend (`/backend` - NestJS 12)
- **`ScraperService` (`scraper.service.ts`)**:
  - Headless Puppeteer crawler tailored for AliExpress product pages.
  - Extracts title, price, description, and high-resolution gallery images.
  - Automatically upgrades thumbnail images to uncompressed full-resolution assets.
  - Built-in anti-bot resilience & fallback generator for demo testing.
- **`AiContentService` (`ai-content.service.ts`)**:
  - Direct integration with Google Gemini (`@google/generative-ai`) via `GEMINI_API_KEY`.
  - Prompts Gemini to return strictly typed JSON with:
    - 3 unique Facebook Ad variations (Hook/Problem-Solution, Social Proof/FOMO, Feature/Value).
    - 3 targeted demographic audience personas.
    - 5 high-intent e-commerce SEO keywords and hashtags.
  - Robust markdown fence stripping and intelligent fallback copy engine.
- **`MediaProcessingService` (`media.service.ts`)**:
  - Downloads top 4 product images with `axios` into `/temp/products/{productId}/`.
  - Resizes and crops to 1080x1080 square format with `sharp`.
  - Stitches images into a 10-second `.mp4` video with smooth crossfade transitions using `fluent-ffmpeg` (`xfade` filter, 25fps, H.264/yuv420p).
  - Configures FFmpeg binary path automatically.
- **`CampaignController` (`campaign.controller.ts`)**:
  - Orchestrates the 3-step pipeline at `POST /api/campaign/generate`.
  - Exposes static files at `http://localhost:3000/temp/` with full CORS support.

### 2. Frontend (`/frontend` - Angular 22 + Tailwind CSS)
- **`CampaignService` (`campaign.service.ts`)**:
  - Consumes `POST http://localhost:3000/api/campaign/generate` with typed RxJS observables and error handling.
- **`DashboardComponent` (`dashboard.component.ts/html`)**:
  - Professional SaaS dashboard with light gray backgrounds (`bg-slate-50`), soft shadows (`shadow-md`), and rounded cards (`rounded-xl`).
  - Top search bar with URL input, "Generate Magic" button, quick test demo chips, and dynamic multi-step loading indicators.
  - **Card 1: Marketing Copy**: 3 Facebook Ad copies with one-click clipboard copying.
  - **Card 2: Target Audience & Keywords**: Demographic cards and interactive rounded keyword badges.
  - **Card 3: Media Gallery**: 2x2 grid of 1080x1080 resized photos + HTML5 responsive `<video>` player for the generated 10-second crossfade MP4 video with download button.

---

## ?? Quick Start Guide

### Prerequisites
- Node.js (v18+ or v26+)
- FFmpeg (Installed and in PATH or standard winget location)
- (Optional) Google Gemini API Key from Google AI Studio

### 1. Configure Gemini API Key (Backend)
Edit `backend/.env`:
```env
PORT=3000
BASE_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```
*(Note: If no key is provided, the backend automatically uses its smart fallback generator for smooth POC demonstrations).*

### 2. Start the Backend
```bash
cd backend
npm run start:dev
```
Backend will run at: `http://localhost:3000`  
Static files served at: `http://localhost:3000/temp/`

### 3. Start the Frontend
```bash
cd frontend
npm start
```
Frontend will be available at: `http://localhost:4200`

---

## ?? Testing the API directly

You can test the endpoint with cURL or PowerShell:

```bash
curl -X POST http://localhost:3000/api/campaign/generate \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://www.aliexpress.com/item/1005006123456789.html\"}"
```
