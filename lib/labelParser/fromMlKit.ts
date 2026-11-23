// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Turns what ML Kit read on the phone into the format the parser was built on
// (PaddleOCR's: a box, the text, a confidence). Plain functions, tested on the computer:
//   npx tsx scripts/checkLabelScan.ts
//
// ML Kit gives blocks → lines → words, each with a rectangle. The parser works on
// lines, like PaddleOCR. One exception: Tesco prints cents small next to the euros
// ("€8" big, "35" small). ML Kit puts both in one line, "€8 35", but the parser joins
// them itself when they arrive as two pieces, so such a line is split into its words.
//
// Reading fixes, from the first in-store scans (Nov 2026). These are ML Kit's own
// habits, so they're fixed here rather than in the parser:
//   "1,09"            → "1.09"         ML Kit often reads the decimal point as a comma
//   "1 KG- 12.98"     → "1 KG = 12.98" the "=" read as a dash; it's a per-kg price
//   "439"             → "4.39"         the point missed on a big price (only when it
//                                      is by far the biggest text in the photo)
//   "Any" + "3"       → "Any 3"        Tesco's "Any 3 for €8" read as two pieces
// From the second batch (crop step, Nov 2026):
//   "4" + ".99"       → "4.99"         Dunnes' big euros with small raised cents
//   "4.59 3.50"       → "4.59", "3.50" two prices read as one line (SuperValu
//                                      shelf and Rewards prices side by side)

import type { OcrPiece } from './extractFromOcr';

// The shape ML Kit returns (only the parts used here)
export type MlRect = { left: number; top: number; right: number; bottom: number };
export type MlWord = { text: string; frame: MlRect };
export type MlLine = { text: string; frame: MlRect; elements: MlWord[] };
export type MlText = { text: string; blocks: { lines: MlLine[] }[] };

// A word this much taller than another in the same line means mixed print sizes
const MIXED_SIZE_RATIO = 1.5;

// A bare 3-digit number this many times taller than any other text is a big price
const BIG_PRICE_RATIO = 2.5;

const height = (r: MlRect) => r.bottom - r.top;
const usable = (r: MlRect) => r.right > r.left && r.bottom > r.top;

function toPiece(text: string, r: MlRect): OcrPiece {
  return [[[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]], text, 1];
}

export function mlKitToOcr(result: MlText): OcrPiece[] {
  const pieces: OcrPiece[] = [];
  for (const block of result.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const text = line.text.trim();
      if (!text || !usable(line.frame)) continue;

      const words = (line.elements ?? []).filter((w) => w.text.trim() && usable(w.frame));
      const heights = words.map((w) => height(w.frame));
      const mixedSizes = words.length >= 2 && Math.max(...heights) / Math.min(...heights) >= MIXED_SIZE_RATIO;

      if (mixedSizes) for (const w of words) pieces.push(toPiece(w.text.trim(), w.frame));
      else pieces.push(toPiece(text, line.frame));
    }
  }
  // Top to bottom, then left to right, like PaddleOCR
  const top = (p: OcrPiece) => Math.min(...p[0].map((pt) => pt[1]));
  const left = (p: OcrPiece) => Math.min(...p[0].map((pt) => pt[0]));
  return fixReadings(pieces.sort((a, b) => top(a) - top(b) || left(a) - left(b)));
}

// ─── Reading fixes ───

const pieceTop = (p: OcrPiece) => Math.min(...p[0].map((pt) => pt[1]));
const pieceBottom = (p: OcrPiece) => Math.max(...p[0].map((pt) => pt[1]));
const pieceLeft = (p: OcrPiece) => Math.min(...p[0].map((pt) => pt[0]));
const pieceRight = (p: OcrPiece) => Math.max(...p[0].map((pt) => pt[0]));
const pieceHeight = (p: OcrPiece) => pieceBottom(p) - pieceTop(p);

export function fixText(text: string): string {
  return text
    .replace(/(?<![\d.,])(\d{1,3}),(\d{2})(?![\d,])/g, '$1.$2')
    .replace(/\b1\s*(kgm?|ltre|ltr|litre|l)\s*[-–—]\s*/gi, '1 $1 = ');
}

export function fixReadings(pieces: OcrPiece[]): OcrPiece[] {
  let out: OcrPiece[] = pieces.map(([box, text, conf]) => [box, fixText(text), conf]);

  // A big price with its point missed: "439" → "4.39"
  const heights = out.map(pieceHeight).sort((a, b) => b - a);
  out = out.map((p) => {
    const t = p[1].trim();
    if (!/^\d{3}$/.test(t)) return p;
    const others = heights.filter((h) => h !== pieceHeight(p));
    const nextTallest = others.length > 0 ? others[0] : 0;
    if (pieceHeight(p) !== heights[0] || pieceHeight(p) < BIG_PRICE_RATIO * nextTallest) return p;
    return [p[0], `${t[0]}.${t.slice(1)}`, p[2]];
  });

  // "Any" with its number read as a separate piece just to the right
  const merged: OcrPiece[] = [];
  const used = new Set<OcrPiece>();
  for (const any of out) {
    if (used.has(any)) continue;
    if (/^any$/i.test(any[1].trim())) {
      const h = pieceHeight(any);
      const num = out.find((n) =>
        n !== any && !used.has(n) && /^\d{1,2}$/.test(n[1].trim()) &&
        pieceLeft(n) >= pieceLeft(any) && pieceLeft(n) - pieceRight(any) <= 1.5 * h &&
        pieceTop(n) < pieceBottom(any) && pieceBottom(n) > pieceTop(any),
      );
      if (num) {
        used.add(num);
        const l = pieceLeft(any), t = Math.min(pieceTop(any), pieceTop(num));
        const r = pieceRight(num), b = Math.max(pieceBottom(any), pieceBottom(num));
        merged.push([[[l, t], [r, t], [r, b], [l, b]], `${any[1].trim()} ${num[1].trim()}`, 1]);
        continue;
      }
    }
    merged.push(any);
  }
  return splitPricePairs(joinRaisedCents(merged.filter((p) => !used.has(p))));
}

const boxOf = (l: number, t: number, r: number, b: number): OcrPiece[0] => [[l, t], [r, t], [r, b], [l, b]];

// Big euros with smaller raised cents just to the right: "4" + ".99" → "4.99".
// (Tesco's "€8" + "35", without the point, is joined by the parser's Tesco profile.)
function joinRaisedCents(pieces: OcrPiece[]): OcrPiece[] {
  const euroRe = /^€?\s*(\d{1,3})\.?$/;
  const centsRe = /^[.,·•](\d{2})$/;
  const out = [...pieces];
  for (const cents of pieces) {
    const cm = centsRe.exec(cents[1].trim());
    if (!cm || !out.includes(cents)) continue;
    const euro = out.find((e) => {
      if (e === cents || !euroRe.test(e[1].trim())) return false;
      const h = pieceHeight(e);
      return (
        pieceHeight(cents) < h &&
        pieceLeft(cents) > pieceLeft(e) &&
        pieceLeft(cents) - pieceRight(e) <= 0.6 * h &&
        pieceTop(cents) >= pieceTop(e) - 0.25 * h &&
        pieceTop(cents) <= pieceTop(e) + 0.5 * h
      );
    });
    if (!euro) continue;
    const joined: OcrPiece = [
      boxOf(pieceLeft(euro), Math.min(pieceTop(euro), pieceTop(cents)), Math.max(pieceRight(euro), pieceRight(cents)), Math.max(pieceBottom(euro), pieceBottom(cents))),
      `€${euroRe.exec(euro[1].trim())![1]}.${cm[1]}`,
      1,
    ];
    out[out.indexOf(euro)] = joined;
    out.splice(out.indexOf(cents), 1);
  }
  return out;
}

// Two prices in one line, "4.59 3.50", split into two pieces. Where each one sits
// is estimated from its share of the characters.
function splitPricePairs(pieces: OcrPiece[]): OcrPiece[] {
  const pairRe = /^(€?\s*\d{1,3}\.\d{2})(\s+)(€?\s*\d{1,3}\.\d{2})$/;
  return pieces.flatMap((p): OcrPiece[] => {
    const m = pairRe.exec(p[1].trim());
    if (!m) return [p];
    const text = p[1].trim();
    const l = pieceLeft(p), r = pieceRight(p), t = pieceTop(p), b = pieceBottom(p);
    const at = (chars: number) => l + ((r - l) * chars) / text.length;
    const firstEnd = at(m[1].length);
    const secondStart = at(m[1].length + m[2].length);
    return [
      [boxOf(l, t, firstEnd, b), m[1], p[2]],
      [boxOf(secondStart, t, r, b), m[3], p[2]],
    ];
  });
}
