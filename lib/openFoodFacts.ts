// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Open Food Facts: the pure parts. Building the web address, reading the reply,
// tidying the name, and the rules for the on-phone cache. No internet calls here,
// so it's tested on the computer:
//   npx tsx scripts/checkOff.ts
// services/productService.ts makes the actual calls.

// The three open databases, asked in this order. They all run the same software,
// so the address and the reply look the same for each.
export type ProductSource = 'openfoodfacts' | 'openbeautyfacts' | 'openproductsfacts';

export const OFF_HOSTS: { host: string; source: ProductSource }[] = [
  { host: 'world.openfoodfacts.org', source: 'openfoodfacts' },
  { host: 'world.openbeautyfacts.org', source: 'openbeautyfacts' },
  { host: 'world.openproductsfacts.org', source: 'openproductsfacts' },
];

// Only ask for what the app uses, so the reply stays small on weak signal
export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'generic_name_en',
  'brands',
  'quantity',
  'image_front_small_url',
  'image_front_url',
  'image_url',
].join(',');

// A product in our own shape, not Open Food Facts' raw reply. If a backend is
// added later, it can return this same shape.
export type LookupProduct = {
  barcode: string;
  product_name: string;      // '' when the database has a photo but no name
  brand: string | null;      // the first brand listed, e.g. 'Heinz'
  quantity: string | null;   // as printed in the database, e.g. '415 g'
  image_url: string | null;  // small front photo, always https
  source: ProductSource;
  fetched_at: string;        // when it was looked up (ISO date), for the cache
};

export function productUrl(host: string, barcode: string): string {
  return `https://${host}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Tidy spacing. Only change the capitals when the whole name is in capitals or
// all lower case: "TAYTO CHEESE & ONION" becomes "Tayto Cheese & Onion", but
// "McVitie's Digestives" is left alone.
export function tidyName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!/[a-z]/i.test(s)) return s;
  if (s === s.toUpperCase() || s === s.toLowerCase()) return titleCase(s);
  return s;
}

// Open Food Facts lists brands with commas, e.g. "Heinz,Kraft Heinz"
function firstBrand(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const first = tidyName(raw.split(',')[0]);
  return first === '' ? null : first;
}

function safeImage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  if (url.startsWith('https://')) return url;
  if (url.startsWith('http://')) return 'https://' + url.slice('http://'.length);
  return null;
}

function text(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

// Turn a reply into a product, or null when the database doesn't have it.
// A product with neither a name nor a photo is treated as not found, since it
// wouldn't fill in anything on the card.
export function parseProductReply(
  reply: unknown,
  barcode: string,
  source: ProductSource,
  now: Date,
): LookupProduct | null {
  if (!reply || typeof reply !== 'object') return null;
  const r = reply as { status?: unknown; product?: unknown };
  if (r.status !== 1 || !r.product || typeof r.product !== 'object') return null;
  const p = r.product as Record<string, unknown>;

  const name =
    [p.product_name_en, p.product_name, p.generic_name_en, p.generic_name]
      .map(tidyName)
      .find((n) => n !== '') ?? '';
  const image = safeImage(p.image_front_small_url) ?? safeImage(p.image_front_url) ?? safeImage(p.image_url);

  if (name === '' && image === null) return null;

  return {
    barcode,
    product_name: name,
    brand: firstBrand(p.brands),
    quantity: text(p.quantity),
    image_url: image,
    source,
    fetched_at: now.toISOString(),
  };
}

// ─── The on-phone cache ────────────────────────────────────────────────────
// Products looked up before, by barcode, so they still work in a shop with no
// signal. Product details change slowly, so a month is fresh enough.

export type ProductCache = Record<string, LookupProduct>;

export const CACHE_MAX = 300;
export const CACHE_FRESH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isFresh(p: LookupProduct, now: Date, days: number = CACHE_FRESH_DAYS): boolean {
  const t = Date.parse(p.fetched_at);
  return Number.isFinite(t) && now.getTime() - t < days * DAY_MS;
}

// Add or replace one product. When the cache is full, the oldest look-ups go first.
export function addToCache(cache: ProductCache, p: LookupProduct, max: number = CACHE_MAX): ProductCache {
  const next: ProductCache = { ...cache, [p.barcode]: p };
  const keys = Object.keys(next);
  if (keys.length <= max) return next;
  keys
    .sort((a, b) => Date.parse(next[a].fetched_at) - Date.parse(next[b].fetched_at))
    .slice(0, keys.length - max)
    .forEach((k) => delete next[k]);
  return next;
}

function looksLikeProduct(v: unknown): v is LookupProduct {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return typeof p.barcode === 'string' && typeof p.product_name === 'string' && typeof p.fetched_at === 'string';
}

// Read what was saved on the phone. Anything damaged is skipped, not trusted.
export function readCache(raw: string | null): ProductCache {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: ProductCache = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (looksLikeProduct(v) && v.barcode === k) out[k] = v;
  }
  return out;
}
