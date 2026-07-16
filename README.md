# AI Product Analysis Assistant

AI Product Analysis Assistant is a Next.js application that turns an Amazon product link, or manually pasted product text, into structured product information, customer-oriented analysis, and a short TikTok-style video script.

## Live Demo

Deployment:
(TODO)

GitHub:
(TODO)

## Project Overview

The tool is designed for cross-border e-commerce operators who need to quickly understand a product, summarize its selling points, and prepare short-form content ideas in Chinese.

## Features

- Amazon link analysis through a server-side scraper.
- Product Information output, including product name, category, price, brand, key features, and specifications.
- Product Analysis output, including target users, use scenarios, pain points, and selling points.
- TikTok-style video script generation with hook, body, and full script text.
- Manual Fallback mode when Amazon content cannot be fetched automatically.
- Unified copy support for Product Information, Product Analysis, and Video Script cards.
- Keyboard shortcuts:
  - Enter in the URL input starts analysis.
  - Ctrl+Enter or Command+Enter in the fallback textarea starts AI analysis.
- Reset behavior that keeps the current URL while clearing analysis state.
- Server-side scraper diagnostics for HTTP status, final URL, page type, selector results, and fallback reason.
- Product image preview with original-image open and browser-native download links.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Cheerio for server-side HTML parsing
- DeepSeek chat completions API
- Vercel-ready Next.js configuration

## Project Structure

```text
src/
  app/
    api/
      analyze/
        route.ts      # API route for product analysis
    globals.css       # Global styles
    layout.tsx        # App layout
    page.tsx          # Main client UI
  lib/
    ai.ts             # DeepSeek API integration
    scraper.ts        # Amazon product scraping and diagnostics
public/               # Static assets
```

## How It Works

```text
Amazon Link
  -> Scraper fetches and parses the product page
  -> Extracted text and images are sent to AI analysis
  -> Structured result is rendered in the UI
  -> If scraping fails, Manual Fallback asks the user to paste product text
```

The scraper attempts to extract product title, price, brand, bullet points, images, description, specifications, JSON-LD data, and Open Graph metadata. If the page cannot be accessed or key content cannot be extracted, the app switches to Manual Fallback instead of blocking the user.

## Running Locally

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Configure the required environment variables:

```env
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful checks:

```bash
npm run lint
npx tsc --noEmit
```

## Engineering Decisions

### Fallback Strategy

Amazon pages can return bot checks, access restrictions, unavailable pages, or HTML that does not contain the expected product selectors. The app uses Manual Fallback so operators can paste product title, bullet points, or descriptions and continue the AI workflow without waiting for scraper fixes.

### Unified Copy Logic

The result cards share one copy implementation and one feedback state model. This keeps copy behavior consistent across Product Information, Product Analysis, and Video Script while avoiding repeated Clipboard API code.

### Keyboard Shortcuts

The UI supports common productivity shortcuts without changing the button flow. URL input Enter, and fallback textarea Ctrl+Enter or Command+Enter, all reuse the same analysis handler used by the primary button.

### Scraper Diagnostics

The scraper logs key server-side diagnostics, including request status, final URL, page type, selector results, and fallback reason. These logs make it easier to understand whether failures come from Amazon access restrictions, selector misses, timeouts, or unknown errors.

### Image Experience

Product images remain simple and dependency-free. Images are displayed without forced cropping, can be opened in a new tab, and expose a native download link.

## Future Improvements

- Improve product extraction reliability across more Amazon page variants.
- Add a stable product-data provider or Amazon Product Advertising API integration for production use.
- Add structured server log aggregation for deployed environments.
- Add focused tests for fallback transitions, keyboard shortcuts, and copy behavior.
- Add optional language or output-style controls if operators need multiple content formats.
