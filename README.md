# PrintCraft Studio

A storefront template for commercial print shops, copy centers and digital press businesses. It's built with React 18, Tailwind CSS and Lucide icons.

Customers can price a job instantly and upload artwork for an automatic pre-flight check. They can also manage corporate orders and check out from a persistent cart.

## Features

| Section | What it does |
|---|---|
| **Header** | Top contact bar with express line, address, hours and support number. Sticky nav highlights the section in view. Cart badge, mobile menu. |
| **Hero** | Headline, quote and upload CTAs, four trust badges, illustrated press sheet. |
| **Instant Price Calculator** | Five product categories, each with its own stocks, sizes and finishes. Quantity slider plus quick picks. Custom dimensions. Tiered volume discounts. Setup fees. Mutually exclusive coatings. Rush pricing. Delivery dates that skip weekends and honor the same-day cutoff. Itemized live quote, add to cart, and a quote document view. |
| **File Uploader + Pre-flight** | Drag-and-drop for `.pdf .ai .psd .png .svg` up to 100 MB. Upload progress. Resolution, color-mode and bleed checks. PNGs are measured for real; other formats get simulated results. Front/back proof preview with bleed, trim and safe-zone guides. |
| **Services Catalog** | Filterable grid (Business Essentials, Banners & Signage, Promo Items, Packaging). Shows starting prices, specs and stock status. "Configure & Order" opens that product in the calculator. |
| **Template Gallery** | Starter layouts that load the matching product into the calculator. |
| **B2B Corporate Portal** | Account perks and a sample dashboard with four tabs: order history with one-click reorder, brand assets, Net-30 invoices, and team approvals. Includes a corporate account application form. |
| **Reviews** | Responsive carousel with ratings, client monograms and product mockups. |
| **Footer** | Link columns, newsletter signup, security badges, payment methods. |
| **Cart drawer** | Saved in `localStorage`. Adjust batch counts, remove items, progress toward free delivery. |

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

## Project structure

```
├── index.html                 # Page shell, fonts, meta tags
├── public/favicon.svg
├── src/
│   ├── main.jsx               # React entry point
│   ├── index.css              # Tailwind layers + custom styles (slider, crop marks, animations)
│   └── PrintCraftStudio.jsx   # The whole app, split into labelled sections
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── .github/workflows/deploy.yml   # GitHub Pages deployment
```

`PrintCraftStudio.jsx` is organized into numbered sections in this order: config, pure helpers, hooks, UI primitives, then one block per page section. You can split it into separate files without changing any logic.

## Customizing for a shop

Everything business-specific lives at the top of `src/PrintCraftStudio.jsx`:

- **`STORE`**: name, phones, address, hours, same-day cutoff hour, free-delivery threshold.
- **`TURNAROUND`**: rush tiers, their multipliers and day ranges.
- **`CATALOG_CONFIG`**: for each product category, the base price, reference area, quantity range, sizes, stocks, finishes (per-unit, area-scaled or setup fee) and volume-discount tiers.
- **`PRODUCTS`, `TEMPLATES`, `REVIEWS`, `SAMPLE_*`**: catalog cards, gallery, testimonials and dashboard data.

Brand colors use Tailwind's `slate`, `sky` and `amber` palettes, which match the design system: `#0F172A`, `#1E293B`, `#0284C7`, `#0EA5E9`, `#F59E0B` and `#F8FAFC`.

## Connecting a backend

The template runs entirely on local state. Search the source for `INTEGRATION:` to find each hand-off point:

| Area | Replace with |
|---|---|
| `calculateQuote()` | Server-side pricing (`/api/pricing`). **Always recalculate on the server before charging.** The client price is an estimate. |
| `useCart()` | Shopify Storefront cart, WooCommerce Store API, or your own cart service |
| Checkout button | Stripe Checkout, Shopify or WooCommerce checkout |
| `runPreflight()` / upload loop | Presigned S3/R2 upload + a pre-flight worker (callas pdfToolbox, Enfocus PitStop, Ghostscript) |
| `QuoteModal` | `/api/quotes` that renders a PDF (pdfkit, Puppeteer) |
| `CorporateApplyModal` | CRM (HubSpot, Salesforce) |
| Footer newsletter | Mailchimp / Klaviyo list |

The pure helpers (`calculateQuote`, `estimateDelivery`, `addBusinessDays`, `CATALOG_CONFIG`) are exported, so a Node/Express server can import the same pricing rules.

## Deploying

**GitHub Pages:** push to `main`, then go to **Settings → Pages → Source** and choose **GitHub Actions**. The included workflow builds and deploys automatically.

**Vercel / Netlify:** import the repo. Build command `npm run build`, output directory `dist`.

## Demo content

Client names, reviews, dashboard figures and the example pre-flight file are fictional sample content. Replace them before going live.
