/**
 * PrintCraft Studio — Commercial Print Shop Storefront
 * ---------------------------------------------------------------------------
 * Single-page React application (functional components + hooks).
 * Styling: Tailwind CSS utility classes. Icons: lucide-react.
 *
 * Integration map (search for "INTEGRATION:" comments):
 *   - Pricing rules ......... CATALOG_CONFIG / calculateQuote()  → move to /api/pricing
 *   - Cart .................. useCart()                          → WooCommerce / Shopify Cart API
 *   - File uploads .......... runPreflight()                     → S3 presigned upload + preflight worker
 *   - Quotes ................ QuoteModal                         → /api/quotes (PDF render, e.g. pdfkit)
 *   - Corporate accounts .... B2BPortal                          → /api/accounts, ERP / invoicing
 *   - Newsletter ............ Footer                             → Mailchimp / Klaviyo list
 *
 * Everything below runs on local state so the template works out of the box.
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Printer, Upload, CheckCircle2, FileText, Calculator, Truck, ShieldCheck, ShoppingCart,
  Phone, MapPin, Clock, Zap, Menu, X, ChevronRight, ChevronLeft, Star, Leaf, Award,
  Building2, CreditCard, RefreshCw, FolderOpen, UserCheck, AlertTriangle, XCircle, Eye,
  Trash2, Plus, Minus, Copy, Layers, Package, Shirt, Ruler, Sparkles, BadgeCheck, Lock,
  Mail, ArrowRight, Flag, Receipt, Users, FileCheck2, Scissors, Info, Loader2, Map,
} from "lucide-react";

/* ============================================================================
 * 1. BUSINESS CONFIG — store details, pricing tables
 * ========================================================================== */

const STORE = {
  name: "PrintCraft Studio",
  phone: "+1 (415) 555-0142",
  expressLine: "+1 (415) 555-0199",
  email: "orders@printcraft.studio",
  address: "1180 Folsom St, San Francisco, CA",
  hours: "Mon–Fri 7:30–20:00 · Sat 9:00–17:00",
  sameDayCutoffHour: 11, // orders placed before 11:00 local qualify for same-day
  freeShippingOver: 150,
};

/**
 * Turnaround tiers. `mult` multiplies the post-discount subtotal.
 * INTEGRATION: keep these in sync with your production scheduler.
 */
const TURNAROUND = [
  { id: "standard", label: "Standard", detail: "3–5 business days", mult: 1, minDays: 3, maxDays: 5, icon: Truck },
  { id: "express", label: "Express", detail: "24 hours", mult: 1.4, minDays: 1, maxDays: 1, icon: Zap },
  { id: "sameday", label: "Same-Day Urgent", detail: `Order by ${STORE.sameDayCutoffHour}:00 AM`, mult: 1.85, minDays: 0, maxDays: 0, icon: Clock },
];

/**
 * Product categories for the price calculator.
 * - baseUnit: price for one unit at the reference area (refArea, in sizeUnit²)
 * - sizes: either w/h (area-priced) or `mult` (fixed multiplier)
 * - finishes: perUnit (optionally scaled by area), one-time setup, `group` = mutually exclusive
 * - tiers: [minQty, discountRate] volume discounts
 */
const CATALOG_CONFIG = [
  {
    id: "business-cards", name: "Business Cards", short: "Cards", icon: CreditCard,
    unitLabel: "cards", sizeUnit: "in", refArea: 7, baseUnit: 0.085, minOrder: 19,
    qtyMin: 50, qtyMax: 10000, qtyStep: 50, quick: [100, 250, 500, 1000, 5000], defaultQty: 500,
    custom: { min: 1.5, max: 4, defaultW: 3.5, defaultH: 2 },
    sizes: [
      { id: "std", label: 'Standard 3.5" × 2"', w: 3.5, h: 2 },
      { id: "sq", label: 'Square 2.5" × 2.5"', w: 2.5, h: 2.5 },
      { id: "slim", label: 'Slim 3.5" × 1.5"', w: 3.5, h: 1.5 },
    ],
    stocks: [
      { id: "std300", label: "Standard 300gsm", note: "Smooth uncoated", mult: 1 },
      { id: "matte350", label: "Premium Matte 350gsm", note: "Velvet touch", mult: 1.25 },
      { id: "gloss400", label: "Glossy 400gsm", note: "High-shine coated", mult: 1.4 },
      { id: "kraft", label: "Recycled Kraft", note: "100% post-consumer", mult: 1.15, eco: true },
      { id: "heavy", label: "Heavyweight Cardstock", note: "600gsm duplex", mult: 1.85 },
    ],
    finishes: [
      { id: "matte-lam", label: "Matte Lamination", perUnit: 0.02, group: "coat" },
      { id: "gloss-uv", label: "Gloss UV Coating", perUnit: 0.015, group: "coat" },
      { id: "spot-uv", label: "Spot UV Foil", perUnit: 0.045, setup: 35 },
      { id: "emboss", label: "Embossing", perUnit: 0.06, setup: 65 },
      { id: "fold", label: "Folded", perUnit: 0.03 },
      { id: "diecut", label: "Die-Cut", perUnit: 0.05, setup: 45 },
    ],
    tiers: [[250, 0.08], [500, 0.15], [1000, 0.25], [5000, 0.38]],
    allowSameDay: true,
  },
  {
    id: "flyers", name: "Marketing Flyers & Brochures", short: "Flyers", icon: FileText,
    unitLabel: "sheets", sizeUnit: "in", refArea: 93.5, baseUnit: 0.28, minOrder: 25,
    qtyMin: 25, qtyMax: 20000, qtyStep: 25, quick: [100, 250, 500, 1000, 5000], defaultQty: 1000,
    custom: { min: 3, max: 17, defaultW: 8.5, defaultH: 11 },
    sizes: [
      { id: "letter", label: 'Letter 8.5" × 11"', w: 8.5, h: 11 },
      { id: "half", label: 'Half Letter 5.5" × 8.5"', w: 5.5, h: 8.5 },
      { id: "tabloid", label: 'Tabloid 11" × 17"', w: 11, h: 17 },
      { id: "rack", label: 'Rack Card 4" × 9"', w: 4, h: 9 },
    ],
    stocks: [
      { id: "silk150", label: "Standard 150gsm Silk", note: "Everyday flyers", mult: 1 },
      { id: "matte170", label: "Premium Matte 170gsm", note: "No glare", mult: 1.18 },
      { id: "gloss200", label: "Glossy 200gsm", note: "Vivid photos", mult: 1.3 },
      { id: "kraft120", label: "Recycled Kraft 120gsm", note: "Natural fibre", mult: 1.12, eco: true },
      { id: "card300", label: "Heavyweight Cardstock 300gsm", note: "Postcard feel", mult: 1.6 },
    ],
    finishes: [
      { id: "matte-lam", label: "Matte Lamination", perUnit: 0.06, group: "coat", scale: true },
      { id: "gloss-uv", label: "Gloss UV Coating", perUnit: 0.04, group: "coat", scale: true },
      { id: "spot-uv", label: "Spot UV Foil", perUnit: 0.09, setup: 45, scale: true },
      { id: "fold", label: "Folded (Bi/Tri)", perUnit: 0.035 },
      { id: "emboss", label: "Embossing", perUnit: 0.14, setup: 85 },
      { id: "diecut", label: "Die-Cut", perUnit: 0.08, setup: 60 },
    ],
    tiers: [[250, 0.07], [500, 0.14], [1000, 0.22], [5000, 0.35]],
    allowSameDay: true,
  },
  {
    id: "banners", name: "Large Format Banners & Vinyl", short: "Banners", icon: Flag,
    unitLabel: "banners", sizeUnit: "ft", refArea: 1, baseUnit: 4.25, minOrder: 35,
    qtyMin: 1, qtyMax: 100, qtyStep: 1, quick: [1, 2, 5, 10, 25], defaultQty: 2,
    custom: { min: 1, max: 16, defaultW: 3, defaultH: 6 },
    sizes: [
      { id: "2x6", label: "2 ft × 6 ft", w: 2, h: 6 },
      { id: "3x8", label: "3 ft × 8 ft", w: 3, h: 8 },
      { id: "4x10", label: "4 ft × 10 ft", w: 4, h: 10 },
      { id: "rollup", label: 'Roll-Up 33" × 79"', w: 2.75, h: 6.58 },
    ],
    stocks: [
      { id: "scrim13", label: "13oz Scrim Vinyl", note: "Indoor / outdoor", mult: 1 },
      { id: "block18", label: "18oz Blockout Vinyl", note: "Double-sided", mult: 1.3 },
      { id: "mesh", label: "Mesh Vinyl", note: "Wind-permeable", mult: 1.2 },
      { id: "fabric", label: "Matte Dye-Sub Fabric", note: "Wrinkle-free", mult: 1.45 },
      { id: "pet", label: "Recycled PET Fabric", note: "From bottles", mult: 1.35, eco: true },
    ],
    finishes: [
      { id: "lam", label: "UV Lamination", perUnit: 0.9, group: "coat", scale: true },
      { id: "grommets", label: "Hemmed + Grommets", perUnit: 6 },
      { id: "pockets", label: "Pole Pockets", perUnit: 9 },
      { id: "slits", label: "Wind Slits", perUnit: 4 },
      { id: "stand", label: "Retractable Stand", perUnit: 48 },
    ],
    tiers: [[5, 0.05], [10, 0.1], [25, 0.18], [50, 0.25]],
    allowSameDay: true,
  },
  {
    id: "apparel", name: "Custom Apparel & Merch", short: "Apparel", icon: Shirt,
    unitLabel: "pieces", sizeUnit: "in", refArea: 120, baseUnit: 6.5, minOrder: 60,
    qtyMin: 12, qtyMax: 2000, qtyStep: 12, quick: [12, 24, 50, 100, 250], defaultQty: 50,
    custom: { min: 2, max: 16, defaultW: 10, defaultH: 12 },
    sizes: [
      { id: "chest", label: 'Left Chest 4" × 4"', mult: 0.8 },
      { id: "front", label: 'Full Front 10" × 12"', mult: 1 },
      { id: "both", label: "Front + Back", mult: 1.55 },
    ],
    stocks: [
      { id: "cotton", label: "Ring-Spun Cotton Tee", note: "180gsm", mult: 1 },
      { id: "triblend", label: "Premium Tri-Blend Tee", note: "Retail fit", mult: 1.3 },
      { id: "organic", label: "Organic Cotton Tee", note: "GOTS certified", mult: 1.25, eco: true },
      { id: "hoodie", label: "Pullover Hoodie", note: "320gsm fleece", mult: 2.6 },
      { id: "tote", label: "Canvas Tote Bag", note: "12oz canvas", mult: 0.9 },
    ],
    finishes: [
      { id: "screen", label: "Screen Print", perUnit: 0, setup: 40, group: "method" },
      { id: "dtg", label: "DTG Full Color", perUnit: 2.5, group: "method" },
      { id: "embroid", label: "Embroidery", perUnit: 4, setup: 50, group: "method" },
      { id: "label", label: "Custom Neck Label", perUnit: 1.2 },
      { id: "bag", label: "Fold & Bag", perUnit: 0.6 },
    ],
    tiers: [[24, 0.08], [50, 0.15], [100, 0.22], [250, 0.3]],
    allowSameDay: false,
  },
  {
    id: "blueprints", name: "Architectural Blueprints / Documents", short: "Blueprints", icon: Ruler,
    unitLabel: "sheets", sizeUnit: "in", refArea: 432, baseUnit: 2.2, minOrder: 10,
    qtyMin: 1, qtyMax: 500, qtyStep: 1, quick: [1, 5, 10, 25, 100], defaultQty: 10,
    custom: { min: 8, max: 48, defaultW: 24, defaultH: 36 },
    sizes: [
      { id: "ansib", label: 'ANSI B 11" × 17"', w: 11, h: 17 },
      { id: "archc", label: 'ARCH C 18" × 24"', w: 18, h: 24 },
      { id: "archd", label: 'ARCH D 24" × 36"', w: 24, h: 36 },
      { id: "arche", label: 'ARCH E 36" × 48"', w: 36, h: 48 },
    ],
    stocks: [
      { id: "bond20", label: "20lb Bond", note: "Standard plots", mult: 1 },
      { id: "bond24", label: "24lb Premium Bond", note: "Brighter white", mult: 1.15 },
      { id: "vellum", label: "Translucent Vellum", note: "Overlay-ready", mult: 1.6 },
      { id: "mylar", label: "Matte Mylar Film", note: "Archival, tear-proof", mult: 2.4 },
      { id: "rbond", label: "Recycled Bond", note: "30% PCW", mult: 1.05, eco: true },
    ],
    finishes: [
      { id: "color", label: "Full-Color Plot", perUnit: 2.5, scale: true },
      { id: "lam", label: "Lamination", perUnit: 4, group: "coat", scale: true },
      { id: "fold", label: "Folded to Letter", perUnit: 0.75 },
      { id: "bind", label: "Bound Set + Cover", perUnit: 0, setup: 15 },
      { id: "mount", label: "Foam Board Mount", perUnit: 12, scale: true },
    ],
    tiers: [[10, 0.05], [25, 0.1], [100, 0.18]],
    allowSameDay: true,
  },
];

const getCategory = (id) => CATALOG_CONFIG.find((c) => c.id === id) || CATALOG_CONFIG[0];

/* ============================================================================
 * 2. PURE HELPERS — pricing, dates, formatting (easy to unit-test / port)
 * ========================================================================== */

const money = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitMoney = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: n < 1 ? 3 : 2 });
const round2 = (n) => Math.round(n * 100) / 100;
const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

/** Add N business days (skips Sat/Sun). INTEGRATION: add shop holidays here. */
function addBusinessDays(from, n) {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}

/** Estimated ready/delivery window for a turnaround tier, honoring the same-day cutoff. */
function estimateDelivery(turnaroundId, now = new Date()) {
  const t = TURNAROUND.find((x) => x.id === turnaroundId) || TURNAROUND[0];
  if (t.id === "sameday") {
    const beforeCutoff = now.getHours() < STORE.sameDayCutoffHour && !isWeekend(now);
    const date = beforeCutoff ? now : addBusinessDays(now, 1);
    return {
      from: date, to: date, label: beforeCutoff ? `Today, ${fmtDate(date)} by 6:00 PM` : `${fmtDate(date)} by 6:00 PM`,
      note: beforeCutoff ? `Same-day cutoff ${STORE.sameDayCutoffHour}:00 AM — you're in time.` : "Past today's cutoff, so this rolls to the next business day.",
    };
  }
  const from = addBusinessDays(now, t.minDays);
  const to = addBusinessDays(now, t.maxDays);
  return {
    from, to,
    label: t.minDays === t.maxDays ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`,
    note: t.id === "express" ? "Printed overnight, delivered next business day." : "Ground delivery included in metro area.",
  };
}

/** Resolve the selected size (preset or custom) to a pricing multiplier + label. */
function resolveSize(cat, sizeId, custom) {
  if (sizeId === "custom") {
    const w = Number(custom.w) || cat.custom.defaultW;
    const h = Number(custom.h) || cat.custom.defaultH;
    return { label: `Custom ${w}${cat.sizeUnit === "in" ? '"' : " ft"} × ${h}${cat.sizeUnit === "in" ? '"' : " ft"}`, ratio: Math.max(0.35, (w * h) / cat.refArea) };
  }
  const s = cat.sizes.find((x) => x.id === sizeId) || cat.sizes[0];
  return { label: s.label, ratio: s.mult ?? Math.max(0.35, (s.w * s.h) / cat.refArea) };
}

/**
 * Core pricing engine. Returns a full line-item breakdown.
 * INTEGRATION: mirror this on the server and treat the client value as an estimate only.
 */
function calculateQuote(cat, cfg) {
  const qty = Math.max(cat.qtyMin, Math.min(cat.qtyMax, Number(cfg.qty) || cat.qtyMin));
  const size = resolveSize(cat, cfg.sizeId, cfg.custom);
  const stock = cat.stocks.find((s) => s.id === cfg.stockId) || cat.stocks[0];
  const finishes = cat.finishes.filter((f) => cfg.finishes.includes(f.id));
  const turn = TURNAROUND.find((t) => t.id === cfg.turnaround) || TURNAROUND[0];

  const baseUnit = cat.baseUnit * size.ratio * stock.mult;
  const finishUnit = finishes.reduce((sum, f) => sum + f.perUnit * (f.scale ? size.ratio : 1), 0);
  const setupFees = finishes.reduce((sum, f) => sum + (f.setup || 0), 0);

  const tier = [...cat.tiers].reverse().find(([min]) => qty >= min);
  const discountRate = tier ? tier[1] : 0;
  const nextTier = cat.tiers.find(([min]) => qty < min);

  const printSubtotal = baseUnit * qty;
  const finishingSubtotal = finishUnit * qty;
  const discount = (printSubtotal + finishingSubtotal) * discountRate;
  const afterDiscount = printSubtotal + finishingSubtotal - discount;
  const rushFee = afterDiscount * (turn.mult - 1);
  let total = afterDiscount + rushFee + setupFees;
  const minimumApplied = total < cat.minOrder;
  if (minimumApplied) total = cat.minOrder;

  return {
    qty, size, stock, finishes, turn, discountRate, nextTier,
    lines: {
      print: round2(printSubtotal),
      finishing: round2(finishingSubtotal),
      discount: round2(discount),
      rush: round2(rushFee),
      setup: round2(setupFees),
    },
    total: round2(total),
    unitPrice: total / qty,
    listUnit: baseUnit + finishUnit,
    minimumApplied,
  };
}

/** Deterministic hash so simulated preflight results are stable per filename. */
function hashString(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* ============================================================================
 * 3. STATE HOOKS — cart + toasts
 * ========================================================================== */

const CART_KEY = "printcraft.cart.v1";

/** Cart state with localStorage persistence. INTEGRATION: swap for Shopify Storefront cart. */
function useCart() {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable — cart stays in memory */
    }
  }, [items]);

  const add = useCallback((item) => setItems((prev) => [...prev, { ...item, id: `ci_${Date.now()}_${prev.length}`, copies: 1 }]), []);
  const remove = useCallback((id) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const setCopies = useCallback(
    (id, delta) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, copies: Math.max(1, Math.min(20, i.copies + delta)) } : i))),
    []
  );
  const clear = useCallback(() => setItems([]), []);
  const count = items.reduce((n, i) => n + i.copies, 0);
  const subtotal = round2(items.reduce((n, i) => n + i.total * i.copies, 0));
  return { items, add, remove, setCopies, clear, count, subtotal };
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  return { toasts, push };
}

/* ============================================================================
 * 4. SHARED UI PRIMITIVES
 * ========================================================================== */

function SectionHeading({ eyebrow, title, children, align = "left", dark = false }) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <p className={`text-xs font-bold uppercase tracking-[0.14em] ${dark ? "text-sky-400" : "text-sky-600"}`}>{eyebrow}</p>
      <h2 className={`mt-2 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl ${dark ? "text-white" : "text-slate-900"}`}>{title}</h2>
      {children && <p className={`mt-3 text-base leading-relaxed ${dark ? "text-slate-300" : "text-slate-600"}`}>{children}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`animate-pop max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "max-w-4xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h3 className="font-display text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Stars({ value, size = "h-4 w-4" }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`} />
      ))}
    </div>
  );
}

/** Print-shop detail: CMYK registration swatches. */
function CmykBar({ className = "" }) {
  return (
    <div className={`flex overflow-hidden rounded ${className}`} aria-hidden="true">
      <span className="h-full flex-1 bg-[#00AEEF]" />
      <span className="h-full flex-1 bg-[#EC008C]" />
      <span className="h-full flex-1 bg-[#FFF200]" />
      <span className="h-full flex-1 bg-slate-900" />
    </div>
  );
}

/* ============================================================================
 * 5. HEADER — top bar, main nav, mobile menu
 * ========================================================================== */

const NAV_LINKS = [
  { id: "services", label: "Services" },
  { id: "calculator", label: "Instant Price Calculator" },
  { id: "upload", label: "Online File Uploader" },
  { id: "templates", label: "Template Gallery" },
  { id: "b2b", label: "B2B Corporate Portal" },
];

function TopBar() {
  return (
    <div className="bg-slate-900 text-slate-300">
      <div className="gutter mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-xs">
        <p className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span>Express orders:</span>
          <span className="font-semibold text-white select-all">{STORE.expressLine}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="hidden items-center gap-1.5 md:flex"><MapPin className="h-3.5 w-3.5 text-sky-400" />{STORE.address}</span>
          <span className="hidden items-center gap-1.5 lg:flex"><Clock className="h-3.5 w-3.5 text-sky-400" />{STORE.hours}</span>
          <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-sky-400" />Support <span className="font-semibold text-white select-all">{STORE.phone}</span></span>
        </div>
      </div>
    </div>
  );
}

function Header({ cartCount, onOpenCart, activeSection }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const prevCount = useRef(cartCount);

  // Animate the cart badge when an item is added
  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  const go = (id) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  return (
    <header className="sticky-safe sticky z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="gutter mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5 text-left" aria-label="PrintCraft Studio home">
          <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white">
            <Printer className="h-5 w-5" />
            <span className="absolute -bottom-1 left-1.5 right-1.5 h-1"><CmykBar className="h-1" /></span>
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[17px] font-extrabold tracking-tight text-slate-900">PrintCraft Studio</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-600">Enterprise Print Solutions</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${activeSection === l.id ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button onClick={() => go("calculator")} className="hidden rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-amber-400 sm:inline-flex">
            Get a Quote
          </button>
          <button onClick={onOpenCart} className="relative rounded-lg border border-slate-200 p-2.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className={`absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-sky-600 px-1 text-[11px] font-bold text-white tabular-nums ${bump ? "animate-bump" : ""}`}>
                {cartCount}
              </span>
            )}
          </button>
          <button onClick={() => setMenuOpen((o) => !o)} className="rounded-lg border border-slate-200 p-2.5 text-slate-700 xl:hidden" aria-label="Toggle menu" aria-expanded={menuOpen}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="gutter border-t border-slate-200 bg-white pb-4 pt-2 xl:hidden" aria-label="Mobile">
          {NAV_LINKS.map((l) => (
            <button key={l.id} onClick={() => go(l.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
              {l.label}
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
          <button onClick={() => go("calculator")} className="mt-2 w-full rounded-lg bg-amber-500 py-3 text-sm font-bold text-slate-900">Get Instant Quote</button>
        </nav>
      )}
    </header>
  );
}

/* ============================================================================
 * 6. HERO
 * ========================================================================== */

const TRUST_BADGES = [
  { icon: Clock, title: "24-Hour Turnaround", text: "On 40+ products" },
  { icon: ShieldCheck, title: "100% Quality Guarantee", text: "Reprint or refund" },
  { icon: Leaf, title: "Eco-Friendly Inks", text: "Vegetable-based, low VOC" },
  { icon: Building2, title: "Bulk Corporate Rates", text: "Up to 38% off volume" },
];

function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-900">
      {/* Halftone dot texture — a nod to offset printing */}
      <div className="halftone pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="gutter relative mx-auto grid max-w-7xl items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Presses running now · Same-day cutoff {STORE.sameDayCutoffHour}:00 AM
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white text-balance sm:text-5xl lg:text-[3.4rem]">
            High-Precision Commercial Printing &amp; <span className="text-sky-400">Express Digital Solutions</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
            From business cards and large-format banners to custom promotional merchandise. Upload your design, preview live, and get same-day local delivery.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => scrollToId("calculator")} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-base font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition hover:-translate-y-0.5 hover:bg-amber-400">
              <Calculator className="h-5 w-5" /> Get Instant Quote
            </button>
            <button onClick={() => scrollToId("upload")} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/60 px-6 py-3.5 text-base font-semibold text-white transition hover:border-sky-400 hover:bg-slate-800">
              <Upload className="h-5 w-5" /> Upload Design File
            </button>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TRUST_BADGES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-slate-700/80 bg-slate-800/50 p-3">
                <Icon className="h-5 w-5 text-sky-400" />
                <dt className="mt-2 text-sm font-semibold leading-snug text-white">{title}</dt>
                <dd className="mt-0.5 text-xs text-slate-400">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroPressSheet />
      </div>
    </section>
  );
}

/** Illustrated press sheet with crop marks, color bar and imposed cards. */
function HeroPressSheet() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
      <div className="relative rotate-[-2deg] rounded-xl bg-white p-6 shadow-2xl shadow-black/40">
        <div className="mb-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
          <span>Sheet 1/4 · 12×18 SRA3</span>
          <span>Job #PC-48217</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { bg: "bg-slate-900", fg: "text-white", accent: "bg-sky-500", name: "Northwind Legal" },
            { bg: "bg-sky-600", fg: "text-white", accent: "bg-amber-400", name: "Harbor & Pine" },
            { bg: "bg-amber-100", fg: "text-slate-900", accent: "bg-slate-900", name: "Saffron Kitchen" },
            { bg: "bg-white border border-slate-200", fg: "text-slate-900", accent: "bg-sky-600", name: "Atlas Dental" },
          ].map((c, i) => (
            <div key={i} className="relative">
              <span className="crop-tl" /><span className="crop-tr" /><span className="crop-bl" /><span className="crop-br" />
              <div className={`aspect-[7/4] rounded-[3px] ${c.bg} ${c.fg} flex flex-col justify-between p-3`}>
                <span className={`h-2 w-6 rounded-sm ${c.accent}`} />
                <div>
                  <p className="text-[11px] font-bold leading-tight">{c.name}</p>
                  <p className="text-[8px] opacity-70">Managing Partner</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <CmykBar className="h-3 w-28" />
          <div className="flex gap-0.5">
            {[100, 80, 60, 40, 20].map((t) => (
              <span key={t} className="h-3 w-3 rounded-[1px] bg-slate-900" style={{ opacity: t / 100 }} />
            ))}
          </div>
          <span className="ml-auto font-mono text-[10px] text-slate-400">ΔE 0.8</span>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:-left-8">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600"><FileCheck2 className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-bold text-slate-900">Pre-flight passed</p>
          <p className="text-[11px] text-slate-500">300 DPI · CMYK · 0.125" bleed</p>
        </div>
      </div>
      <div className="absolute -right-2 -top-4 flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-900 shadow-lg sm:-right-6">
        <Truck className="h-4 w-4" /> Out for delivery 4:30 PM
      </div>
    </div>
  );
}

/* ============================================================================
 * 7. PRICE CALCULATOR — core commercial feature
 * ========================================================================== */

const defaultConfigFor = (cat) => ({
  qty: cat.defaultQty,
  stockId: cat.stocks[0].id,
  sizeId: cat.sizes[0].id,
  custom: { w: cat.custom.defaultW, h: cat.custom.defaultH },
  finishes: [],
  turnaround: "standard",
});

function PriceCalculator({ categoryId, setCategoryId, onAddToCart, onToast }) {
  const cat = getCategory(categoryId);
  const [cfg, setCfg] = useState(() => defaultConfigFor(cat));
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Reset configuration whenever the category changes (from switcher, catalog or templates)
  useEffect(() => {
    setCfg(defaultConfigFor(getCategory(categoryId)));
  }, [categoryId]);

  // Keep same-day cutoff + delivery estimate accurate while the page is open
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const quote = useMemo(() => calculateQuote(cat, cfg), [cat, cfg]);
  const delivery = useMemo(() => estimateDelivery(cfg.turnaround, now), [cfg.turnaround, now]);

  const update = (patch) => setCfg((c) => ({ ...c, ...patch }));

  /** Toggle a finish; options in the same `group` are mutually exclusive. */
  const toggleFinish = (f) =>
    setCfg((c) => {
      if (c.finishes.includes(f.id)) return { ...c, finishes: c.finishes.filter((x) => x !== f.id) };
      const sameGroup = f.group ? cat.finishes.filter((x) => x.group === f.group).map((x) => x.id) : [];
      return { ...c, finishes: [...c.finishes.filter((x) => !sameGroup.includes(x)), f.id] };
    });

  const handleAdd = () => {
    onAddToCart({
      title: cat.name,
      categoryId: cat.id,
      summary: [
        `${quote.qty.toLocaleString()} ${cat.unitLabel}`,
        quote.size.label,
        quote.stock.label,
        quote.finishes.length ? quote.finishes.map((f) => f.label).join(", ") : "No finishing",
        `${quote.turn.label} · ${delivery.label}`,
      ],
      total: quote.total,
      unitPrice: quote.unitPrice,
    });
    onToast(`${cat.short} added to cart — ${money(quote.total)}`);
  };

  const sliderPct = ((quote.qty - cat.qtyMin) / (cat.qtyMax - cat.qtyMin)) * 100;

  return (
    <section id="calculator" className="scroll-mt-20 bg-slate-50 py-20">
      <div className="gutter mx-auto max-w-7xl">
        <SectionHeading eyebrow="Instant Price Calculator" title="Configure your job. Watch the price update as you go.">
          Every option is priced live, including volume discounts, setup fees and rush charges. No email back-and-forth.
        </SectionHeading>

        {/* Category switcher */}
        <div className="mt-8 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="Product category">
          {CATALOG_CONFIG.map((c) => {
            const Icon = c.icon;
            const active = c.id === cat.id;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                onClick={() => setCategoryId(c.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${active ? "border-slate-900 bg-slate-900 text-white shadow-md" : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700"}`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-sky-400" : "text-slate-400"}`} />
                {c.name}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* ---------- Configuration inputs ---------- */}
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            {/* Quantity */}
            <fieldset>
              <div className="flex items-baseline justify-between gap-4">
                <legend className="text-sm font-bold text-slate-900">Quantity</legend>
                <div className="flex items-center gap-2">
                  <input
                    id="qty-input"
                    type="number"
                    min={cat.qtyMin}
                    max={cat.qtyMax}
                    step={cat.qtyStep}
                    value={cfg.qty}
                    onChange={(e) => update({ qty: e.target.value })}
                    onBlur={() => update({ qty: quote.qty })}
                    className="w-28 rounded-lg border border-slate-200 px-3 py-1.5 text-right text-sm font-semibold tabular-nums focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    aria-label="Quantity"
                  />
                  <span className="text-sm text-slate-500">{cat.unitLabel}</span>
                </div>
              </div>
              <input
                id="qty-range"
                type="range"
                min={cat.qtyMin}
                max={cat.qtyMax}
                step={cat.qtyStep}
                value={quote.qty}
                onChange={(e) => update({ qty: Number(e.target.value) })}
                className="range mt-4 w-full"
                style={{ "--pct": `${sliderPct}%` }}
                aria-label="Quantity slider"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {cat.quick.map((q, i) => (
                  <button
                    key={q}
                    onClick={() => update({ qty: q })}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums transition ${quote.qty === q ? "border-sky-600 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    {q.toLocaleString()}{i === cat.quick.length - 1 ? "+" : ""}
                  </button>
                ))}
              </div>
              {quote.nextTier && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Order {quote.nextTier[0].toLocaleString()}+ to unlock {Math.round(quote.nextTier[1] * 100)}% volume pricing.
                </p>
              )}
            </fieldset>

            <hr className="border-slate-100" />

            {/* Stock */}
            <fieldset>
              <legend className="text-sm font-bold text-slate-900">{cat.id === "apparel" ? "Garment" : cat.id === "banners" ? "Material" : "Paper / Stock Type"}</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {cat.stocks.map((s) => {
                  const active = cfg.stockId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => update({ stockId: s.id })}
                      className={`flex items-start justify-between gap-2 rounded-xl border p-3 text-left transition ${active ? "border-sky-600 bg-sky-50 ring-1 ring-sky-600" : "border-slate-200 hover:border-slate-300"}`}
                      aria-pressed={active}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{s.label}</span>
                        <span className="block text-xs text-slate-500">{s.note}</span>
                      </span>
                      {s.eco ? <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Eco option" /> : active ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <hr className="border-slate-100" />

            {/* Size */}
            <fieldset>
              <legend className="text-sm font-bold text-slate-900">{cat.id === "apparel" ? "Print Placement" : "Sizing"}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {cat.sizes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => update({ sizeId: s.id })}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${cfg.sizeId === s.id ? "border-sky-600 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    {s.label}
                  </button>
                ))}
                {cat.id !== "apparel" && (
                  <button
                    onClick={() => update({ sizeId: "custom" })}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${cfg.sizeId === "custom" ? "border-sky-600 bg-sky-50 text-sky-700" : "border-dashed border-slate-300 text-slate-600 hover:border-slate-400"}`}
                  >
                    <Ruler className="h-4 w-4" /> Custom dimensions
                  </button>
                )}
              </div>
              {cfg.sizeId === "custom" && (
                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
                  {["w", "h"].map((k) => (
                    <label key={k} className="text-xs font-semibold text-slate-600">
                      {k === "w" ? "Width" : "Height"} ({cat.sizeUnit})
                      <input
                        id={`custom-${k}`}
                        type="number"
                        min={cat.custom.min}
                        max={cat.custom.max}
                        step={cat.sizeUnit === "in" ? 0.25 : 0.5}
                        value={cfg.custom[k]}
                        onChange={(e) => update({ custom: { ...cfg.custom, [k]: e.target.value } })}
                        onBlur={(e) => {
                          const v = Math.min(cat.custom.max, Math.max(cat.custom.min, Number(e.target.value) || cat.custom.min));
                          update({ custom: { ...cfg.custom, [k]: v } });
                        }}
                        className="mt-1 block w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                    </label>
                  ))}
                  <p className="pb-2 text-xs text-slate-500">
                    Allowed {cat.custom.min}–{cat.custom.max} {cat.sizeUnit}. Add 0.125" bleed to your artwork.
                  </p>
                </div>
              )}
            </fieldset>

            <hr className="border-slate-100" />

            {/* Finishing */}
            <fieldset>
              <legend className="text-sm font-bold text-slate-900">{cat.id === "apparel" ? "Decoration & Extras" : "Finishing Options"}</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {cat.finishes.map((f) => {
                  const on = cfg.finishes.includes(f.id);
                  return (
                    <label key={f.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${on ? "border-sky-600 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <input id={`finish-${cat.id}-${f.id}`} type="checkbox" checked={on} onChange={() => toggleFinish(f)} className="h-4 w-4 rounded border-slate-300 accent-sky-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{f.label}</span>
                        <span className="block text-xs text-slate-500">
                          {f.perUnit ? `+${unitMoney(f.perUnit)}/${f.scale ? "unit*" : "unit"}` : "Included"}
                          {f.setup ? ` · ${money(f.setup)} setup` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {cat.finishes.some((f) => f.group) && (
                <p className="mt-2 text-xs text-slate-500">
                  {cat.id === "apparel" ? "Pick one decoration method." : "Coatings are exclusive: choosing one replaces the other."}
                  {cat.finishes.some((f) => f.scale) ? " *Scaled by size." : ""}
                </p>
              )}
            </fieldset>

            <hr className="border-slate-100" />

            {/* Turnaround */}
            <fieldset>
              <legend className="text-sm font-bold text-slate-900">Turnaround Time</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {TURNAROUND.map((t) => {
                  const Icon = t.icon;
                  const disabled = t.id === "sameday" && !cat.allowSameDay;
                  const active = cfg.turnaround === t.id;
                  return (
                    <button
                      key={t.id}
                      disabled={disabled}
                      onClick={() => update({ turnaround: t.id })}
                      className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500" : "border-slate-200 hover:border-slate-300"}`}
                      aria-pressed={active}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Icon className={`h-4 w-4 ${active ? "text-amber-600" : "text-slate-400"}`} /> {t.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{disabled ? "Not available for this product" : t.detail}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-700">{t.mult === 1 ? "No rush fee" : `+${Math.round((t.mult - 1) * 100)}% rush`}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* ---------- Live output card ---------- */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl">
              <CmykBar className="h-1.5 rounded-none" />
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Live quote</p>
                <p className="mt-1 text-sm text-slate-300">{cat.name}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="font-display text-4xl font-extrabold tabular-nums tracking-tight" aria-live="polite">{money(quote.total)}</p>
                  <p className="pb-1 text-right text-sm text-slate-300 tabular-nums">
                    {unitMoney(quote.unitPrice)}<span className="text-slate-500"> / {cat.unitLabel.replace(/s$/, "")}</span>
                  </p>
                </div>
                {quote.discountRate > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    <BadgeCheck className="h-3.5 w-3.5" /> {Math.round(quote.discountRate * 100)}% volume discount applied
                  </p>
                )}

                <dl className="mt-5 space-y-2 border-t border-slate-700 pt-4 text-sm tabular-nums">
                  <Row label={`Printing (${quote.qty.toLocaleString()} × ${unitMoney(quote.lines.print / quote.qty)})`} value={money(quote.lines.print)} />
                  {quote.lines.finishing > 0 && <Row label="Finishing" value={money(quote.lines.finishing)} />}
                  {quote.lines.discount > 0 && <Row label="Volume discount" value={`−${money(quote.lines.discount)}`} tone="good" />}
                  {quote.lines.setup > 0 && <Row label="One-time setup" value={money(quote.lines.setup)} />}
                  {quote.lines.rush > 0 && <Row label={`${quote.turn.label} rush`} value={money(quote.lines.rush)} tone="warn" />}
                  {quote.minimumApplied && <Row label="Minimum order applied" value={money(cat.minOrder)} />}
                </dl>

                <div className="mt-5 rounded-xl bg-slate-800 p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Truck className="h-4 w-4 text-sky-400" /> Estimated delivery</p>
                  <p className="mt-1 font-display text-lg font-bold">{delivery.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{delivery.note}</p>
                </div>

                <ul className="mt-4 space-y-1 text-xs text-slate-400">
                  <li>{quote.size.label} · {quote.stock.label}</li>
                  <li>{quote.finishes.length ? quote.finishes.map((f) => f.label).join(" · ") : "No finishing selected"}</li>
                </ul>

                <div className="mt-6 grid gap-2">
                  <button onClick={handleAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-slate-900 transition hover:bg-amber-400">
                    <ShoppingCart className="h-4 w-4" /> Add Configuration to Cart
                  </button>
                  <button onClick={() => setQuoteOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 py-3 text-sm font-semibold text-white transition hover:border-sky-400 hover:bg-slate-800">
                    <FileText className="h-4 w-4" /> Download Instant PDF Quote
                  </button>
                </div>
                <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500"><Lock className="h-3 w-3" /> Price locked for 30 days. Tax calculated at checkout.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <QuoteModal open={quoteOpen} onClose={() => setQuoteOpen(false)} cat={cat} quote={quote} delivery={delivery} onToast={onToast} />
    </section>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`font-semibold ${tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-white"}`}>{value}</dd>
    </div>
  );
}

/**
 * Quote document preview.
 * INTEGRATION: POST the config to /api/quotes, render the PDF server-side and stream it back.
 * The on-screen document below mirrors that PDF layout.
 */
function QuoteModal({ open, onClose, cat, quote, delivery, onToast }) {
  const quoteNo = useMemo(() => `Q-${new Date().getFullYear()}-${String(hashString(JSON.stringify(quote.lines) + cat.id) % 100000).padStart(5, "0")}`, [quote, cat]);
  const validUntil = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }, []);

  const plainText = [
    `${STORE.name} — Quote ${quoteNo}`,
    `${cat.name}: ${quote.qty.toLocaleString()} ${cat.unitLabel}`,
    `${quote.size.label}, ${quote.stock.label}`,
    `Finishing: ${quote.finishes.map((f) => f.label).join(", ") || "None"}`,
    `Turnaround: ${quote.turn.label} (${delivery.label})`,
    `Total: ${money(quote.total)} (${unitMoney(quote.unitPrice)} each)`,
    `Valid until ${validUntil}`,
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      onToast("Quote copied to clipboard");
    } catch {
      onToast("Copy isn't available here. Select the quote text instead.", "info");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Instant Quote" wide>
      <div className="rounded-xl border border-slate-200 p-6 sm:p-8 select-text">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white"><Printer className="h-5 w-5" /></span>
            <div>
              <p className="font-display text-lg font-extrabold text-slate-900">{STORE.name}</p>
              <p className="text-xs text-slate-500">{STORE.address} · {STORE.phone}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-mono font-bold text-slate-900">{quoteNo}</p>
            <p className="text-slate-500">Valid until {validUntil}</p>
          </div>
        </div>
        <CmykBar className="mt-5 h-1" />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2.5"><p className="font-semibold text-slate-900">{cat.name}</p><p className="text-xs text-slate-500">{quote.qty.toLocaleString()} {cat.unitLabel} · {quote.size.label} · {quote.stock.label}</p></td><td className="py-2.5 text-right">{money(quote.lines.print)}</td></tr>
              {quote.finishes.map((f) => (
                <tr key={f.id}><td className="py-2.5 text-slate-700">{f.label}{f.setup ? ` (incl. ${money(f.setup)} setup)` : ""}</td><td className="py-2.5 text-right text-slate-500">incl.</td></tr>
              ))}
              {quote.lines.finishing > 0 && <tr><td className="py-2.5 text-slate-700">Finishing subtotal</td><td className="py-2.5 text-right">{money(quote.lines.finishing)}</td></tr>}
              {quote.lines.discount > 0 && <tr><td className="py-2.5 text-emerald-700">Volume discount ({Math.round(quote.discountRate * 100)}%)</td><td className="py-2.5 text-right text-emerald-700">−{money(quote.lines.discount)}</td></tr>}
              {quote.lines.setup > 0 && <tr><td className="py-2.5 text-slate-700">Setup &amp; tooling</td><td className="py-2.5 text-right">{money(quote.lines.setup)}</td></tr>}
              {quote.lines.rush > 0 && <tr><td className="py-2.5 text-slate-700">{quote.turn.label} production</td><td className="py-2.5 text-right">{money(quote.lines.rush)}</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900"><td className="pt-3 font-display text-base font-bold">Total (before tax)</td><td className="pt-3 text-right font-display text-xl font-extrabold">{money(quote.total)}</td></tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Turnaround:</span> <span className="font-semibold">{quote.turn.label}</span></p>
          <p><span className="text-slate-500">Est. delivery:</span> <span className="font-semibold">{delivery.label}</span></p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">Artwork must be supplied as press-ready PDF with 0.125" bleed, 300 DPI, CMYK. Prices exclude sales tax. Quote valid 30 days.</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-slate-500"><Info className="h-3.5 w-3.5" /> PDF export runs on the server in production.</p>
        <button onClick={copy} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Copy className="h-4 w-4" /> Copy quote</button>
      </div>
    </Modal>
  );
}

/* ============================================================================
 * 8. FILE UPLOAD + PRE-FLIGHT
 * ========================================================================== */

const ACCEPTED_EXT = ["pdf", "ai", "psd", "png", "svg"];
const MAX_MB = 100;
const VECTOR_EXT = ["pdf", "ai", "svg"];
const PREFLIGHT_STEPS = [
  { id: "resolution", label: "Resolution check", icon: Eye },
  { id: "color", label: "Color mode verification", icon: Layers },
  { id: "bleed", label: "Bleed & trim margins", icon: Scissors },
];

/** Read pixel dimensions of a raster image (PNG). */
function readImageSize(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Simulated pre-flight. Raster PNGs are measured for real; other formats get
 * deterministic results based on file name so the demo is repeatable.
 * INTEGRATION: replace with a call to your preflight worker (e.g. callas pdfToolbox, Enfocus PitStop).
 */
async function runPreflight(file, ext, previewUrl) {
  const h = hashString(file.name);
  const results = {};

  // Resolution — business card trim width 3.5" (+0.25" bleed)
  if (VECTOR_EXT.includes(ext)) {
    results.resolution = { status: h % 5 === 0 ? "warn" : "pass", detail: h % 5 === 0 ? "1 placed image at 220 DPI. Vector art OK." : "Vector artwork, all images ≥ 300 DPI." };
  } else if (ext === "png" && previewUrl) {
    const dim = await readImageSize(previewUrl);
    if (dim) {
      const dpi = Math.round(dim.w / 3.75);
      results.resolution = dpi >= 300
        ? { status: "pass", detail: `${dim.w}×${dim.h}px ≈ ${dpi} DPI at business card size.` }
        : { status: dpi >= 150 ? "warn" : "fail", detail: `${dim.w}×${dim.h}px ≈ ${dpi} DPI. 300 DPI needs ${Math.round(3.75 * 300)}px wide.` };
    } else results.resolution = { status: "warn", detail: "Couldn't read pixel size. We'll verify manually." };
  } else {
    results.resolution = { status: "pass", detail: "Document set to 300 DPI." };
  }

  // Color mode — PNG/SVG are always RGB
  if (ext === "png" || ext === "svg") {
    results.color = { status: "warn", detail: "RGB detected. We'll convert to CMYK (FOGRA39); brights may shift." };
  } else {
    results.color = h % 3 === 0 ? { status: "warn", detail: "Mixed RGB + CMYK objects found." } : { status: "pass", detail: "CMYK, rich black 60/40/40/100." };
  }

  // Bleed — PNG aspect tells us whether bleed was included
  if (ext === "png" && previewUrl) {
    const dim = await readImageSize(previewUrl);
    const ratio = dim ? dim.w / dim.h : 0;
    results.bleed = Math.abs(ratio - 3.75 / 2.25) < 0.04
      ? { status: "pass", detail: '0.125" bleed on all sides.' }
      : { status: "warn", detail: 'Artwork matches trim size. Extend backgrounds 0.125" past trim.' };
  } else {
    results.bleed = h % 2 === 0 ? { status: "pass", detail: '0.125" bleed, text inside 0.125" safe zone.' } : { status: "warn", detail: 'Bleed is 0.0625". 0.125" is required.' };
  }
  return results;
}

/** Example file shown on first load so the tool opens in a working state. */
const SAMPLE_FILE = {
  id: "sample",
  name: "atlas-dental-card_v3.pdf",
  ext: "pdf",
  sizeLabel: "2.4 MB",
  status: "done",
  progress: 100,
  sample: true,
  checks: {
    resolution: { status: "pass", detail: "Vector artwork, all images ≥ 300 DPI." },
    color: { status: "pass", detail: "CMYK, rich black 60/40/40/100." },
    bleed: { status: "warn", detail: 'Bleed is 0.0625". 0.125" is required.' },
  },
};

const formatBytes = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function FileUploader({ onToast, onPickProduct }) {
  const [files, setFiles] = useState([SAMPLE_FILE]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [previewId, setPreviewId] = useState(null);
  const inputRef = useRef(null);
  const urlsRef = useRef([]);

  // Release object URLs on unmount
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const patchFile = (id, patch) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...(typeof patch === "function" ? patch(f) : patch) } : f)));

  const processFile = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) {
      setError(`${file.name} isn't supported. Upload PDF, AI, PSD, PNG or SVG.`);
      return;
    }
    if (file.size > MAX_MB * 1048576) {
      setError(`${file.name} is over ${MAX_MB} MB. Compress it or send a download link to ${STORE.email}.`);
      return;
    }
    const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const previewUrl = ext === "png" || ext === "svg" ? URL.createObjectURL(file) : null;
    if (previewUrl) urlsRef.current.push(previewUrl);
    setFiles((fs) => [{ id, name: file.name, ext, sizeLabel: formatBytes(file.size), status: "uploading", progress: 0, checks: {}, previewUrl }, ...fs]);

    // INTEGRATION: replace with a presigned S3 PUT and real progress events
    for (let p = 12; p <= 100; p += 11) {
      await sleep(110);
      patchFile(id, { progress: Math.min(100, p) });
    }
    patchFile(id, { status: "checking", progress: 100 });
    const results = await runPreflight(file, ext, previewUrl);
    for (const step of PREFLIGHT_STEPS) {
      await sleep(550);
      patchFile(id, (f) => ({ checks: { ...f.checks, [step.id]: results[step.id] } }));
    }
    patchFile(id, { status: "done" });
    const issues = Object.values(results).filter((r) => r.status !== "pass").length;
    onToast(issues ? `Pre-flight finished with ${issues} item${issues > 1 ? "s" : ""} to review` : "Pre-flight passed. Ready for press", issues ? "info" : "success");
  };

  const handleFiles = (list) => {
    setError("");
    Array.from(list).slice(0, 5).forEach(processFile);
  };

  const removeFile = (id) => setFiles((fs) => fs.filter((f) => f.id !== id));
  const previewFile = files.find((f) => f.id === previewId);

  return (
    <section id="upload" className="scroll-mt-20 bg-white py-20">
      <div className="gutter mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading eyebrow="Online File Uploader" title="Upload artwork. Get a pre-flight report in seconds.">
            We check resolution, color mode and bleed before a prepress tech ever opens your file, so problems surface now instead of after the press run.
          </SectionHeading>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {[
              ["300 DPI minimum", "for photos and raster art at final size"],
              ["CMYK color", "RGB files are converted with the FOGRA39 profile"],
              ['0.125" bleed', "on every edge that prints to the trim"],
              ['0.125" safe zone', "for text and logos inside the trim"],
            ].map(([a, b]) => (
              <li key={a} className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /><span><strong className="text-slate-900">{a}</strong> {b}</span></li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${dragging ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/40"}`}
          >
            <span className={`grid h-14 w-14 place-items-center rounded-2xl transition ${dragging ? "bg-sky-600 text-white" : "bg-white text-sky-600 shadow-sm"}`}>
              <Upload className="h-7 w-7" />
            </span>
            <p className="mt-4 font-display text-lg font-bold text-slate-900">{dragging ? "Drop to upload" : "Drag & drop your design files"}</p>
            <p className="mt-1 text-sm text-slate-500">or <span className="font-semibold text-sky-600 underline-offset-2 hover:underline">browse your computer</span> · up to {MAX_MB} MB each</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {ACCEPTED_EXT.map((e) => (
                <span key={e} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-slate-600">.{e}</span>
              ))}
            </div>
            <input id="file-input" ref={inputRef} type="file" multiple accept=".pdf,.ai,.psd,.png,.svg" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
          )}

          <ul className="mt-5 space-y-3">
            {files.map((f) => (
              <PreflightCard key={f.id} file={f} onRemove={() => removeFile(f.id)} onPreview={() => setPreviewId(f.id)} onOrder={onPickProduct} />
            ))}
          </ul>
        </div>
      </div>

      <ProofPreviewModal file={previewFile} onClose={() => setPreviewId(null)} />
    </section>
  );
}

const STATUS_STYLE = {
  pass: { icon: CheckCircle2, cls: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700", label: "Pass" },
  warn: { icon: AlertTriangle, cls: "text-amber-500", chip: "bg-amber-50 text-amber-700", label: "Review" },
  fail: { icon: XCircle, cls: "text-red-600", chip: "bg-red-50 text-red-700", label: "Fail" },
};

function PreflightCard({ file, onRemove, onPreview, onOrder }) {
  const checks = Object.values(file.checks);
  const overall = file.status !== "done" ? null : checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "pass";
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 font-mono text-[10px] font-bold uppercase text-slate-600">{file.ext}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
            <span className="truncate">{file.name}</span>
            {file.sample && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Example</span>}
          </p>
          <p className="text-xs text-slate-500">
            {file.sizeLabel} · {file.status === "uploading" ? `Uploading ${file.progress}%` : file.status === "checking" ? "Running pre-flight…" : "Pre-flight complete"}
          </p>
        </div>
        {overall && <span className={`hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline ${STATUS_STYLE[overall].chip}`}>{overall === "pass" ? "Press-ready" : overall === "warn" ? "Needs review" : "Fix required"}</span>}
        <button onClick={onRemove} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Remove ${file.name}`}><Trash2 className="h-4 w-4" /></button>
      </div>

      {file.status === "uploading" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${file.progress}%` }} />
        </div>
      )}

      {file.status !== "uploading" && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {PREFLIGHT_STEPS.map((s) => {
            const r = file.checks[s.id];
            const st = r ? STATUS_STYLE[r.status] : null;
            const Icon = st ? st.icon : Loader2;
            return (
              <li key={s.id} className="rounded-lg bg-slate-50 p-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Icon className={`h-4 w-4 shrink-0 ${st ? st.cls : "animate-spin text-slate-400"}`} /> {s.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{r ? r.detail : "Checking…"}</p>
              </li>
            );
          })}
        </ul>
      )}

      {file.status === "done" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onPreview} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700"><Eye className="h-3.5 w-3.5" /> Preview proof</button>
          <button onClick={() => onOrder("business-cards")} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">Price this job <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </li>
  );
}

/** Front/back proof with bleed, trim and safe-zone guides. */
function ProofPreviewModal({ file, onClose }) {
  const [side, setSide] = useState("front");
  const [guides, setGuides] = useState(true);
  useEffect(() => setSide("front"), [file?.id]);
  if (!file) return null;
  const brand = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\bv\d+\b/i, "").trim() || "Your Brand";
  const title = brand.replace(/\b\w/g, (m) => m.toUpperCase());

  return (
    <Modal open onClose={onClose} title={`Proof · ${file.name}`} wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 p-1" role="tablist">
          {["front", "back"].map((s) => (
            <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition ${side === s ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}>{s}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input id="guides-toggle" type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="h-4 w-4 accent-sky-600" /> Show print guides
        </label>
      </div>

      <div className="mt-5 grid place-items-center rounded-xl bg-slate-100 p-6 sm:p-10">
        <div className="relative w-full max-w-lg" style={{ aspectRatio: "3.75 / 2.25" }}>
          {/* Artwork including bleed */}
          <div className="absolute inset-0 overflow-hidden shadow-xl">
            {side === "front" ? (
              file.previewUrl ? (
                <img src={file.previewUrl} alt="Uploaded artwork" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col justify-between bg-slate-900 p-[9%] text-white">
                  <span className="h-[10%] w-[14%] rounded-sm bg-sky-500" />
                  <div>
                    <p className="font-display text-[clamp(14px,3.6vw,26px)] font-extrabold leading-tight">{title}</p>
                    <p className="mt-1 text-[clamp(9px,1.6vw,12px)] text-slate-300">Dr. Maya Okafor, DDS · Clinical Director</p>
                  </div>
                </div>
              )
            ) : (
              <div className="grid h-full w-full grid-cols-[1fr_auto] items-center gap-4 bg-white p-[9%]">
                <div className="space-y-1 text-[clamp(9px,1.6vw,12px)] text-slate-700">
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p>{STORE.phone}</p>
                  <p>hello@{brand.split(" ")[0].toLowerCase() || "brand"}.com</p>
                  <p>{STORE.address}</p>
                </div>
                <div className="grid aspect-square w-[22%] min-w-[44px] grid-cols-4 gap-[2px] bg-white p-1 ring-1 ring-slate-200" aria-hidden="true">
                  {Array.from({ length: 16 }).map((_, i) => <span key={i} className={(hashString(brand + i) % 2) ? "bg-slate-900" : "bg-white"} />)}
                </div>
              </div>
            )}
          </div>
          {guides && (
            <>
              <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-red-500/80" />
              <div className="pointer-events-none absolute border border-slate-900" style={{ inset: "5.556% 3.333%" }} />
              <div className="pointer-events-none absolute border border-dashed border-sky-500" style={{ inset: "11.11% 6.667%" }} />
            </>
          )}
        </div>
        {guides && (
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-red-500" /> Bleed 3.75" × 2.25"</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t border-slate-900" /> Trim 3.5" × 2"</span>
            <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t border-dashed border-sky-500" /> Safe zone</span>
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {PREFLIGHT_STEPS.map((s) => {
          const r = file.checks[s.id];
          if (!r) return null;
          const st = STATUS_STYLE[r.status];
          const Icon = st.icon;
          return <p key={s.id} className="flex items-center gap-2 text-xs text-slate-600"><Icon className={`h-4 w-4 ${st.cls}`} /> {s.label}: <strong>{st.label}</strong></p>;
        })}
      </div>
    </Modal>
  );
}

/* ============================================================================
 * 9. PRODUCT & SERVICE CATALOG
 * ========================================================================== */

const CATALOG_FILTERS = ["All", "Business Essentials", "Banners & Signage", "Promo Items", "Packaging"];

const PRODUCTS = [
  { id: "p1", name: "Premium Business Cards", group: "Business Essentials", from: 19, unit: "250 cards", specs: ["14pt–32pt stocks", "Spot UV & foil", "Rounded corners"], stock: "in", calc: "business-cards", icon: CreditCard, tint: "bg-sky-100 text-sky-700" },
  { id: "p2", name: "Letterhead & Envelopes", group: "Business Essentials", from: 48, unit: "250 sets", specs: ["100gsm laid / wove", "#10 window envelopes", "Pantone match"], stock: "in", calc: "flyers", icon: Mail, tint: "bg-slate-200 text-slate-700" },
  { id: "p3", name: "Tri-Fold Brochures", group: "Business Essentials", from: 89, unit: "500 pcs", specs: ["Letter or Tabloid", "Scored & folded", "Gloss or matte"], stock: "in", calc: "flyers", icon: FileText, tint: "bg-amber-100 text-amber-700" },
  { id: "p4", name: "Vinyl Outdoor Banners", group: "Banners & Signage", from: 35, unit: "per banner", specs: ["13oz–18oz vinyl", "Hemmed + grommets", "UV-resistant inks"], stock: "in", calc: "banners", icon: Flag, tint: "bg-sky-100 text-sky-700" },
  { id: "p5", name: "Retractable Roll-Up Stands", group: "Banners & Signage", from: 129, unit: "per stand", specs: ['33" × 79" graphic', "Carry case included", "Swap-in graphics"], stock: "low", calc: "banners", icon: Layers, tint: "bg-slate-200 text-slate-700" },
  { id: "p6", name: "Foam Board & Plans", group: "Banners & Signage", from: 24, unit: "per board", specs: ['Up to 36" × 48"', "3/16\" or 1/2\" core", "Easel back option"], stock: "in", calc: "blueprints", icon: Ruler, tint: "bg-amber-100 text-amber-700" },
  { id: "p7", name: "Branded T-Shirts & Hoodies", group: "Promo Items", from: 60, unit: "12 pieces", specs: ["Screen, DTG, embroidery", "XS–4XL sizing", "Organic options"], stock: "in", calc: "apparel", icon: Shirt, tint: "bg-sky-100 text-sky-700" },
  { id: "p8", name: "Die-Cut Vinyl Stickers", group: "Promo Items", from: 29, unit: "100 stickers", specs: ["Any shape", "Waterproof laminate", "Kiss-cut sheets"], stock: "in", calc: "business-cards", icon: Scissors, tint: "bg-amber-100 text-amber-700" },
  { id: "p9", name: "Custom Mailer Boxes", group: "Packaging", from: 210, unit: "50 boxes", specs: ["E-flute corrugated", "Inside + outside print", "Ships flat"], stock: "made", calc: null, icon: Package, tint: "bg-slate-200 text-slate-700" },
  { id: "p10", name: "Product Labels on Rolls", group: "Packaging", from: 75, unit: "500 labels", specs: ["BOPP or paper", "Freezer-grade adhesive", "Variable data"], stock: "low", calc: null, icon: Receipt, tint: "bg-sky-100 text-sky-700" },
];

const STOCK_BADGE = {
  in: { label: "In stock", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  low: { label: "Low stock", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  made: { label: "Made to order", cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

function ProductCatalog({ onConfigure, onToast }) {
  const [filter, setFilter] = useState("All");
  const visible = useMemo(() => (filter === "All" ? PRODUCTS : PRODUCTS.filter((p) => p.group === filter)), [filter]);

  return (
    <section id="services" className="scroll-mt-20 bg-white py-20">
      <div className="gutter mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Services" title="Everything a business prints, under one roof.">
            Digital and offset presses, wide-format plotters and an in-house finishing bindery.
          </SectionHeading>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter products">
            {CATALOG_FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => {
            const Icon = p.icon;
            const sb = STOCK_BADGE[p.stock];
            return (
              <article key={p.id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className={`grid h-12 w-12 place-items-center rounded-xl ${p.tint}`}><Icon className="h-6 w-6" /></span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${sb.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${sb.dot}`} />{sb.label}</span>
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{p.group}</p>
                <h3 className="mt-1 font-display text-lg font-bold text-slate-900">{p.name}</h3>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate-600">
                  {p.specs.map((s) => <li key={s} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-sky-500" />{s}</li>)}
                </ul>
                <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">Starting at<span className="block font-display text-2xl font-extrabold text-slate-900 tabular-nums">${p.from}</span><span>{p.unit}</span></p>
                </div>
                <button
                  onClick={() => (p.calc ? onConfigure(p.calc) : onToast(`${p.name} are quoted by our packaging team. Call ${STORE.phone}.`, "info"))}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition group-hover:bg-sky-600"
                >
                  {p.calc ? "Configure & Order" : "Request Quote"} <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
 * 10. TEMPLATE GALLERY
 * ========================================================================== */

const TEMPLATES = [
  { id: "t1", name: "Monolith", kind: "Business Card", calc: "business-cards", bg: "bg-slate-900", accent: "bg-sky-400", text: "text-white", ratio: "aspect-[7/4]" },
  { id: "t2", name: "Open House", kind: "Real Estate Flyer", calc: "flyers", bg: "bg-sky-600", accent: "bg-amber-400", text: "text-white", ratio: "aspect-[17/22]" },
  { id: "t3", name: "Grand Opening", kind: "Vinyl Banner", calc: "banners", bg: "bg-amber-400", accent: "bg-slate-900", text: "text-slate-900", ratio: "aspect-[3/1]" },
  { id: "t4", name: "Field Crew", kind: "Team T-Shirt", calc: "apparel", bg: "bg-slate-200", accent: "bg-sky-600", text: "text-slate-900", ratio: "aspect-square" },
  { id: "t5", name: "Bistro Menu", kind: "Tri-Fold Brochure", calc: "flyers", bg: "bg-white border border-slate-200", accent: "bg-amber-500", text: "text-slate-900", ratio: "aspect-[17/22]" },
  { id: "t6", name: "Site Plan Set", kind: "ARCH D Sheet", calc: "blueprints", bg: "bg-sky-900", accent: "bg-sky-300", text: "text-sky-100", ratio: "aspect-[3/2]" },
];

function TemplateGallery({ onUse }) {
  return (
    <section id="templates" className="scroll-mt-20 bg-slate-50 py-20">
      <div className="gutter mx-auto max-w-7xl">
        <SectionHeading eyebrow="Template Gallery" title="Start from a press-ready layout.">
          Every template is built at final size with bleed and safe zones already set. Swap in your logo and copy.
        </SectionHeading>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => onUse(t)} className="group rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="grid h-36 place-items-center rounded-xl bg-slate-100 p-3">
                <div className={`${t.ratio} max-h-full w-full max-w-full ${t.bg} ${t.text} flex flex-col justify-between rounded-[3px] p-2 shadow-md`} style={{ maxWidth: t.ratio === "aspect-[17/22]" ? "62%" : undefined }}>
                  <span className={`h-1.5 w-1/4 rounded-sm ${t.accent}`} />
                  <span className="space-y-1">
                    <span className="block h-1.5 w-3/4 rounded-sm bg-current opacity-80" />
                    <span className="block h-1 w-1/2 rounded-sm bg-current opacity-40" />
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-900">{t.name}</p>
              <p className="text-xs text-slate-500">{t.kind}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 opacity-80 transition group-hover:opacity-100">Use template <ChevronRight className="h-3.5 w-3.5" /></p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
 * 11. B2B CORPORATE PORTAL
 * ========================================================================== */

const B2B_PERKS = [
  { icon: UserCheck, title: "Dedicated Account Manager", text: "One named contact who knows your brand standards and deadlines." },
  { icon: Receipt, title: "Net-30 Invoice Billing", text: "Consolidated monthly invoices with PO numbers and cost centers." },
  { icon: RefreshCw, title: "Reorder in 1-Click", text: "Every approved job is saved with its exact specs and proofs." },
  { icon: FolderOpen, title: "Brand Asset Storage", text: "Logos, fonts and approved templates in one shared library." },
];

const DASH_TABS = [
  { id: "orders", label: "Order History", icon: Package },
  { id: "assets", label: "Brand Assets", icon: FolderOpen },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "team", label: "Team & Approvals", icon: Users },
];

const SAMPLE_ORDERS = [
  { id: "PC-48112", item: "Business Cards · 12 staff", spec: "Premium Matte 350gsm, Spot UV", qty: 3000, total: 486.0, status: "Delivered", date: "Oct 14", calc: "business-cards" },
  { id: "PC-47980", item: "Trade Show Roll-Up Stands", spec: '33" × 79", Matte Fabric', qty: 4, total: 742.4, status: "In production", date: "Oct 22", calc: "banners" },
  { id: "PC-47651", item: "Onboarding Welcome Tees", spec: "Organic Cotton, DTG front", qty: 120, total: 1188.0, status: "Delivered", date: "Sep 30", calc: "apparel" },
  { id: "PC-47422", item: "Q4 Product Brochures", spec: "Tabloid tri-fold, Gloss 200gsm", qty: 2500, total: 1312.5, status: "Delivered", date: "Sep 18", calc: "flyers" },
];

const SAMPLE_INVOICES = [
  { id: "INV-2026-1093", period: "October 2026", amount: 2416.4, due: "Nov 30", status: "Open" },
  { id: "INV-2026-0981", period: "September 2026", amount: 3870.15, due: "Oct 30", status: "Due in 2 days" },
  { id: "INV-2026-0874", period: "August 2026", amount: 1954.0, due: "Sep 30", status: "Paid" },
];

const SAMPLE_ASSETS = [
  { name: "Primary logo — CMYK", type: "AI", size: "1.2 MB", tag: "Approved" },
  { name: "Logo — knockout white", type: "PDF", size: "640 KB", tag: "Approved" },
  { name: "Brand palette — Pantone 2945 C", type: "ASE", size: "12 KB", tag: "Spec" },
  { name: "Business card master", type: "INDD", size: "8.4 MB", tag: "Template" },
  { name: "Neue Haas Grotesk (licensed)", type: "OTF", size: "2.1 MB", tag: "Font" },
];

const SAMPLE_TEAM = [
  { name: "Priya Raman", role: "Marketing Director", rule: "Approves orders over $1,000", initials: "PR" },
  { name: "Daniel Cho", role: "Office Manager", rule: "Can order up to $1,000", initials: "DC" },
  { name: "Leah Fontaine", role: "Brand Designer", rule: "Uploads & approves proofs", initials: "LF" },
];

function B2BPortal({ onReorder }) {
  const [tab, setTab] = useState("orders");
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <section id="b2b" className="scroll-mt-20 bg-slate-900 py-20">
      <div className="gutter mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="B2B Corporate Portal" title="Print procurement for teams, without the purchase-order chase." dark>
              Corporate accounts get volume pricing, approval workflows and consolidated billing across every office.
            </SectionHeading>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {B2B_PERKS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                  <Icon className="h-5 w-5 text-sky-400" />
                  <p className="mt-2 text-sm font-bold text-white">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setApplyOpen(true)} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-amber-400">
              Open a Corporate Account <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Sample dashboard */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-700 bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-sky-600 text-xs font-bold text-white">MK</span>
                <p className="text-sm font-bold text-slate-900">Meridian Kinetics · Corporate</p>
              </div>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">Sample dashboard</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-200 text-center">
              {[["YTD spend", "$18,420"], ["Saved vs. retail", "$4,106"], ["Credit available", "$11,580"]].map(([k, v]) => (
                <div key={k} className="px-2 py-3">
                  <p className="text-[11px] text-slate-500">{k}</p>
                  <p className="font-display text-base font-extrabold text-slate-900 tabular-nums sm:text-lg">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3" role="tablist">
              {DASH_TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition ${tab === id ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <div className="min-h-[300px] p-4 sm:p-5">
              {tab === "orders" && (
                <ul className="divide-y divide-slate-100">
                  {SAMPLE_ORDERS.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{o.item}</p>
                        <p className="text-xs text-slate-500"><span className="font-mono">{o.id}</span> · {o.spec} · {o.qty.toLocaleString()} pcs · {o.date}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.status === "Delivered" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>{o.status}</span>
                      <span className="w-20 text-right text-sm font-semibold tabular-nums text-slate-900">{money(o.total)}</span>
                      <button onClick={() => onReorder(o)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-500 hover:text-sky-700">
                        <RefreshCw className="h-3.5 w-3.5" /> Reorder
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {tab === "assets" && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {SAMPLE_ASSETS.map((a) => (
                    <li key={a.name} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-600">{a.type}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{a.name}</p>
                        <p className="text-xs text-slate-500">{a.size}</p>
                      </div>
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">{a.tag}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tab === "invoices" && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm tabular-nums">
                    <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="pb-2 font-semibold">Invoice</th><th className="pb-2 font-semibold">Period</th><th className="pb-2 text-right font-semibold">Amount</th><th className="pb-2 text-right font-semibold">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {SAMPLE_INVOICES.map((i) => (
                        <tr key={i.id}>
                          <td className="py-3 font-mono text-xs text-slate-700">{i.id}</td>
                          <td className="py-3 text-slate-700">{i.period}<span className="block text-xs text-slate-400">Due {i.due}</span></td>
                          <td className="py-3 text-right font-semibold text-slate-900">{money(i.amount)}</td>
                          <td className="py-3 text-right"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.status === "Paid" ? "bg-emerald-50 text-emerald-700" : i.status === "Open" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>{i.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-4 text-xs text-slate-500">Net-30 terms · Pay by ACH, card or check · PO #MK-2026-114 attached to all invoices</p>
                </div>
              )}
              {tab === "team" && (
                <ul className="space-y-2">
                  {SAMPLE_TEAM.map((m) => (
                    <li key={m.name} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{m.initials}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.role}</p>
                      </div>
                      <span className="hidden text-xs text-slate-600 sm:block">{m.rule}</span>
                    </li>
                  ))}
                  <p className="flex items-center gap-1.5 pt-2 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-sky-600" /> Orders over $1,000 route to Priya for approval before printing.</p>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      <CorporateApplyModal open={applyOpen} onClose={() => setApplyOpen(false)} />
    </section>
  );
}

/** INTEGRATION: POST to /api/accounts/apply → CRM (HubSpot / Salesforce). */
function CorporateApplyModal({ open, onClose }) {
  const [form, setForm] = useState({ company: "", email: "", spend: "1k-5k" });
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setSent(false); setErr(""); } }, [open]);
  const submit = (e) => {
    e.preventDefault();
    if (!form.company.trim()) return setErr("Enter your company name.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setErr("Enter a work email like name@company.com.");
    setErr("");
    setSent(true);
  };
  return (
    <Modal open={open} onClose={onClose} title="Open a Corporate Account">
      {sent ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="mt-3 font-display text-lg font-bold text-slate-900">Application received</p>
          <p className="mt-1 text-sm text-slate-600">An account manager will contact {form.email} within one business day.</p>
          <button onClick={onClose} className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Done</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <label className="block text-sm font-semibold text-slate-700">Company name
            <input id="apply-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20" placeholder="Meridian Kinetics" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Work email
            <input id="apply-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20" placeholder="you@company.com" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">Monthly print spend
            <select id="apply-spend" value={form.spend} onChange={(e) => setForm({ ...form, spend: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-sky-500 focus:outline-none">
              <option value="lt1k">Under $1,000</option>
              <option value="1k-5k">$1,000 – $5,000</option>
              <option value="5k-20k">$5,000 – $20,000</option>
              <option value="gt20k">Over $20,000</option>
            </select>
          </label>
          {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
          <button type="submit" className="w-full rounded-lg bg-amber-500 py-3 text-sm font-bold text-slate-900 hover:bg-amber-400">Submit application</button>
        </form>
      )}
    </Modal>
  );
}

/* ============================================================================
 * 12. REVIEWS
 * ========================================================================== */

const REVIEWS = [
  { name: "Marcus Bell", role: "Owner", company: "Bell & Rowe Architects", mono: "BR", monoCls: "bg-slate-900 text-white", rating: 5, product: "ARCH D plan sets", date: "Oct 2026",
    text: "Forty sheets of ARCH D plotted and bound by 3 PM for a permit submittal. Line weights were crisp and the vellum overlays registered perfectly.",
    mock: { bg: "bg-sky-900", ratio: "aspect-[3/2]", accent: "bg-sky-300" } },
  { name: "Ana Delgado", role: "Marketing Lead", company: "Saffron Kitchen Group", mono: "SK", monoCls: "bg-amber-400 text-slate-900", rating: 5, product: "Tri-fold menus", date: "Oct 2026",
    text: "The pre-flight caught that our menu photos were RGB before we ever paid. Color came out exactly like the proof.",
    mock: { bg: "bg-amber-100", ratio: "aspect-[17/22]", accent: "bg-amber-500" } },
  { name: "Jordan Pike", role: "Events Manager", company: "Northline Tech Summit", mono: "NT", monoCls: "bg-sky-600 text-white", rating: 5, product: "12 roll-up stands", date: "Sep 2026",
    text: "Ordered at 9:40 AM, stands were at the venue loading dock that evening. The fabric graphics have no glare under booth lights.",
    mock: { bg: "bg-sky-600", ratio: "aspect-[2/5]", accent: "bg-white" } },
  { name: "Grace Whitfield", role: "Office Manager", company: "Whitfield Dental", mono: "WD", monoCls: "bg-emerald-600 text-white", rating: 4, product: "Business cards", date: "Sep 2026",
    text: "Reordering cards for new hires takes a minute now. One batch shipped a day late, and they credited the rush fee without being asked.",
    mock: { bg: "bg-white border border-slate-200", ratio: "aspect-[7/4]", accent: "bg-emerald-600" } },
  { name: "Theo Nakamura", role: "Founder", company: "Kiln & Co. Ceramics", mono: "KC", monoCls: "bg-orange-700 text-white", rating: 5, product: "Kraft mailer boxes", date: "Aug 2026",
    text: "The kraft mailers look premium and the inside print surprised every customer. Packaging team helped us fix the dieline.",
    mock: { bg: "bg-[#C8A27A]", ratio: "aspect-square", accent: "bg-slate-900" } },
  { name: "Renee Okoye", role: "People Ops", company: "Meridian Kinetics", mono: "MK", monoCls: "bg-slate-700 text-white", rating: 5, product: "Organic onboarding tees", date: "Aug 2026",
    text: "120 organic tees in six sizes, folded and bagged per person. Net-30 billing made finance happy too.",
    mock: { bg: "bg-slate-200", ratio: "aspect-square", accent: "bg-sky-600" } },
];

function Reviews() {
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(3);

  useEffect(() => {
    const calc = () => setPerView(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const maxIndex = Math.max(0, REVIEWS.length - perView);
  useEffect(() => setIndex((i) => Math.min(i, maxIndex)), [maxIndex]);

  return (
    <section id="reviews" className="scroll-mt-20 bg-white py-20">
      <div className="gutter mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Customer Reviews" title="Trusted by 3,400+ local businesses." />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2"><span className="font-display text-2xl font-extrabold text-slate-900">4.9</span><Stars value={4.9} /></div>
              <p className="text-xs text-slate-500">from 2,184 verified orders</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="rounded-full border border-slate-200 p-2.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-40" aria-label="Previous reviews"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))} disabled={index >= maxIndex} className="rounded-full border border-slate-200 p-2.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-40" aria-label="Next reviews"><ChevronRight className="h-5 w-5" /></button>
            </div>
          </div>
        </div>

        <div className="mt-10 overflow-hidden">
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${(index * 100) / perView}%)` }}>
            {REVIEWS.map((r) => (
              <div key={r.name} className="shrink-0 px-2.5" style={{ width: `${100 / perView}%` }}>
                <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  {/* Finished-product photo stand-in: printed piece on a desk surface */}
                  <div className="grid h-40 place-items-center rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 p-4">
                    <div className={`${r.mock.ratio} max-h-full ${r.mock.bg} flex flex-col justify-between rounded-[3px] p-2.5 shadow-lg`} style={{ height: "100%" }}>
                      <span className={`h-1.5 w-1/3 rounded-sm ${r.mock.accent}`} />
                      <span className="space-y-1"><span className={`block h-1 w-3/4 rounded-sm ${r.mock.accent} opacity-60`} /><span className={`block h-1 w-1/2 rounded-sm ${r.mock.accent} opacity-40`} /></span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Stars value={r.rating} />
                    <span className="text-xs text-slate-400">{r.date}</span>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">“{r.text}”</p>
                  <p className="mt-3 text-xs font-semibold text-sky-700">{r.product}</p>
                  <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-display text-sm font-extrabold ${r.monoCls}`}>{r.mono}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{r.name}</p>
                      <p className="truncate text-xs text-slate-500">{r.role}, {r.company}</p>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><BadgeCheck className="h-4 w-4" />Verified</span>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-1.5">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-sky-600" : "w-2 bg-slate-300"}`} aria-label={`Go to slide ${i + 1}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
 * 13. FOOTER
 * ========================================================================== */

const FOOTER_COLS = [
  { title: "Print Products", links: ["Business Cards", "Flyers & Brochures", "Banners & Signage", "Apparel & Merch", "Blueprints & Plans"] },
  { title: "Services", links: ["Graphic Design", "Mailing Services", "Large Format", "Packaging", "Rush Printing"] },
  { title: "Company", links: ["About the Studio", "Equipment List", "Careers", "Sustainability", "Contact"] },
  { title: "Support", links: ["File Setup Guide", "Order Tracking", "Shipping & Pickup", "Quality Guarantee", "FAQ"] },
];

function Footer({ onToast }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | error | done

  // INTEGRATION: POST to your ESP (Mailchimp / Klaviyo) with tag "corporate-discounts"
  const subscribe = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setState("error");
    setState("done");
    onToast("Subscribed. Watch for your 10% corporate code.");
  };

  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="gutter mx-auto max-w-7xl py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-900"><Printer className="h-5 w-5" /></span>
              <span className="font-display text-lg font-extrabold text-white">PrintCraft Studio</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed">Commercial digital, offset and wide-format printing for businesses that can't miss a deadline.</p>
            <form onSubmit={subscribe} className="mt-6" noValidate>
              <label htmlFor="newsletter-email" className="text-sm font-semibold text-white">Corporate discounts, monthly</label>
              <p className="mt-1 text-xs">Get 10% off your first corporate order plus paper-stock deals.</p>
              {state === "done" ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-400"><CheckCircle2 className="h-4 w-4" /> You're subscribed as {email}</p>
              ) : (
                <div className="mt-3 flex max-w-sm gap-2">
                  <input id="newsletter-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setState("idle"); }} placeholder="you@company.com" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none" />
                  <button type="submit" className="rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500">Subscribe</button>
                </div>
              )}
              {state === "error" && <p className="mt-2 text-xs text-red-400" role="alert">Enter a valid email address.</p>}
            </form>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLS.map((c) => (
              <div key={c.title}>
                <p className="text-sm font-semibold text-white">{c.title}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {c.links.map((l) => <li key={l}><a href="#" onClick={(e) => e.preventDefault()} className="transition hover:text-sky-400">{l}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-slate-800 pt-8">
          <div className="flex flex-wrap gap-3">
            {[[Lock, "256-bit SSL"], [ShieldCheck, "PCI DSS compliant"], [Award, "G7 Master Qualified"], [Leaf, "FSC® certified paper"]].map(([Icon, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300"><Icon className="h-3.5 w-3.5 text-sky-400" />{label}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Accepted payment methods">
            {["VISA", "Mastercard", "AMEX", "Apple Pay", "ACH", "Net-30"].map((p) => (
              <span key={p} className="rounded-md bg-white px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-slate-900">{p}</span>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-between gap-3 text-xs">
          <p>© {new Date().getFullYear()} PrintCraft Studio, Inc. All rights reserved.</p>
          <p className="flex items-center gap-1.5"><Map className="h-3.5 w-3.5" />{STORE.address} · {STORE.email}</p>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================================
 * 14. CART DRAWER + TOASTS
 * ========================================================================== */

function CartDrawer({ open, onClose, cart }) {
  const [checkoutNote, setCheckoutNote] = useState(false);
  useEffect(() => { if (!open) setCheckoutNote(false); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const shipping = cart.subtotal >= STORE.freeShippingOver || cart.subtotal === 0 ? 0 : 12.95;
  const toFree = Math.max(0, STORE.freeShippingOver - cart.subtotal);

  return (
    <div className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-slate-900/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
      <aside className={`drawer-safe absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`} aria-label="Shopping cart">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><ShoppingCart className="h-5 w-5" /> Your Cart <span className="text-sm font-medium text-slate-500">({cart.count})</span></h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close cart"><X className="h-5 w-5" /></button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400"><ShoppingCart className="h-8 w-8" /></span>
            <p className="mt-4 font-display font-bold text-slate-900">Your cart is empty</p>
            <p className="mt-1 text-sm text-slate-500">Configure a job in the price calculator and add it here.</p>
            <button onClick={() => { onClose(); scrollToId("calculator"); }} className="mt-5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-900">Open calculator</button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5">
              {cart.items.map((i) => {
                const Icon = getCategory(i.categoryId).icon;
                return (
                  <li key={i.id} className="py-4">
                    <div className="flex gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600"><Icon className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{i.title}</p>
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-500">{i.summary.map((s, k) => <li key={k}>{s}</li>)}</ul>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-slate-200">
                            <button onClick={() => cart.setCopies(i.id, -1)} className="p-1.5 text-slate-500 hover:text-slate-900" aria-label="Fewer batches"><Minus className="h-3.5 w-3.5" /></button>
                            <span className="w-14 text-center text-xs font-semibold tabular-nums">{i.copies} {i.copies > 1 ? "jobs" : "job"}</span>
                            <button onClick={() => cart.setCopies(i.id, 1)} className="p-1.5 text-slate-500 hover:text-slate-900" aria-label="More batches"><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                          <p className="text-sm font-bold tabular-nums text-slate-900">{money(i.total * i.copies)}</p>
                        </div>
                      </div>
                      <button onClick={() => cart.remove(i.id)} className="self-start rounded p-1 text-slate-400 hover:text-red-600" aria-label={`Remove ${i.title}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-slate-200 bg-slate-50 p-5">
              {toFree > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-600">Add <strong>{money(toFree)}</strong> for free local delivery</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.min(100, (cart.subtotal / STORE.freeShippingOver) * 100)}%` }} /></div>
                </div>
              )}
              <dl className="space-y-1.5 text-sm tabular-nums">
                <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd className="font-semibold">{money(cart.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600">Local delivery</dt><dd className="font-semibold">{shipping ? money(shipping) : "Free"}</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><dt className="font-bold">Total</dt><dd className="font-display font-extrabold">{money(cart.subtotal + shipping)}</dd></div>
              </dl>
              {/* INTEGRATION: create a checkout session (Shopify / Stripe / WooCommerce) and redirect */}
              <button onClick={() => setCheckoutNote(true)} className="mt-4 w-full rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-slate-900 hover:bg-amber-400">Proceed to Checkout</button>
              {checkoutNote && <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-600"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Checkout isn't connected in this demo. Hook up Stripe, Shopify or WooCommerce at the marked integration point.</p>}
              <button onClick={cart.clear} className="mt-2 w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Clear cart</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="toast-safe pointer-events-none fixed bottom-0 left-1/2 z-[80] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="animate-pop pointer-events-auto flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          {t.tone === "info" ? <Info className="h-4 w-4 shrink-0 text-sky-400" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
 * 15. APP ROOT
 * ========================================================================== */

export default function PrintCraftStudio() {
  const cart = useCart();
  const { toasts, push } = useToasts();
  const [cartOpen, setCartOpen] = useState(false);
  const [calcCategory, setCalcCategory] = useState("business-cards");
  const [activeSection, setActiveSection] = useState("");

  // Highlight the nav link for the section currently in view
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.id);
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveSection(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" }
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const configure = (categoryId) => {
    setCalcCategory(categoryId);
    setTimeout(() => scrollToId("calculator"), 30);
  };

  const reorder = (order) => {
    cart.add({ title: order.item, categoryId: order.calc, summary: [`Reorder of ${order.id}`, order.spec, `${order.qty.toLocaleString()} pcs · Standard turnaround`], total: order.total, unitPrice: order.total / order.qty });
    push(`Reorder of ${order.id} added to cart`);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <TopBar />
      <Header cartCount={cart.count} onOpenCart={() => setCartOpen(true)} activeSection={activeSection} />
      <main>
        <Hero />
        <PriceCalculator categoryId={calcCategory} setCategoryId={setCalcCategory} onAddToCart={cart.add} onToast={push} />
        <FileUploader onToast={push} onPickProduct={configure} />
        <ProductCatalog onConfigure={configure} onToast={push} />
        <TemplateGallery onUse={(t) => { configure(t.calc); push(`"${t.name}" template loaded into the calculator`); }} />
        <B2BPortal onReorder={reorder} />
        <Reviews />
      </main>
      <Footer onToast={push} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} />
      <Toasts toasts={toasts} />
    </div>
  );
}

/* Export pure helpers for server-side reuse and unit tests */
export { calculateQuote, estimateDelivery, addBusinessDays, CATALOG_CONFIG, TURNAROUND, getCategory };
