// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// How scripts/checkShelfBarcodes.ts decides whether Open Food Facts found the
// same product as the shelf label. Test-only rules, checked by
//   npx tsx scripts/checkFindBarcode.ts

const SKIP = new Set(['the', 'and', 'with', 'for', 'from', 'pack', 'each', 'new']);

// Words worth comparing: lower case, letters and numbers only, 3+ characters
export function keyWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // é → e
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter((w) => w.length >= 3 && !SKIP.has(w) && !/\d/.test(w)); // sizes like 330ml are compared separately
  return [...new Set(words)];
}

const squash = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

// Share of the label's words (brand + item name) that appear in what Open Food
// Facts returned. Squashed, so "NATURE'SPICK" still matches "Nature's Pick".
export function nameScore(labelText: string, offText: string): number {
  const words = keyWords(labelText);
  if (words.length === 0) return 0;
  const target = squash(offText);
  const hits = words.filter((w) => target.includes(w)).length;
  return Math.round((hits / words.length) * 100) / 100;
}

export type NameVerdict = 'match' | 'partial' | 'different';

export function nameVerdict(score: number): NameVerdict {
  if (score >= 0.6) return 'match';
  if (score >= 0.25) return 'partial';
  return 'different';
}

// Reads a size as printed on labels or in Open Food Facts:
//   "500gm", "500 g", "675grm", "0.5kg", "1kgm" → 500 g, 675 g, 500 g, 1000 g
//   "72mls", "33cl", "1ltr", "1 litre"           → 72 ml, 330 ml, 1000 ml, 1000 ml
//   "4 x 125g", "4x125g"                          → 500 g in total, 125 g each
type Size = { total: number; each: number; unit: 'g' | 'ml' };

const UNIT = String.raw`(kgm|kgs|kg|grams|gram|grms|grm|gms|gm|gr|g|mls|ml|cl|litres|litre|liters|liter|ltrs|ltr|l)\b`;

function toBase(n: number, u: string): { amount: number; unit: 'g' | 'ml' } {
  if (u.startsWith('k')) return { amount: n * 1000, unit: 'g' };
  if (u.startsWith('g')) return { amount: n, unit: 'g' };
  if (u.startsWith('m')) return { amount: n, unit: 'ml' };
  if (u === 'cl') return { amount: n * 10, unit: 'ml' };
  return { amount: n * 1000, unit: 'ml' };
}

export function parseSize(text: string): Size | null {
  const t = text.toLowerCase().replace(/,/g, '.');
  const multi = new RegExp(String.raw`(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*` + UNIT).exec(t);
  if (multi) {
    const b = toBase(Number(multi[2]), multi[3]);
    return { total: Math.round(b.amount * Number(multi[1]) * 100) / 100, each: b.amount, unit: b.unit };
  }
  const one = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*` + UNIT).exec(t);
  if (!one) return null;
  const b = toBase(Number(one[1]), one[2]);
  return { total: b.amount, each: b.amount, unit: b.unit };
}

export type SizeVerdict = 'same' | 'different' | 'unknown';

// Same if the totals agree, or the single-item sizes do ("4 x 125g" vs "125 g")
export function sizeVerdict(labelSize: string, offSize: string): SizeVerdict {
  const a = parseSize(labelSize);
  const b = parseSize(offSize);
  if (!a || !b) return 'unknown';
  if (a.unit !== b.unit) return 'different';
  const near = (x: number, y: number) => Math.abs(x - y) < 0.5;
  return near(a.total, b.total) || near(a.each, b.each) || near(a.total, b.each) || near(a.each, b.total) ? 'same' : 'different';
}
