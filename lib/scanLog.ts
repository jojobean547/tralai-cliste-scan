// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Saved scans for testing the label reader in store. Each time a scanned label is
// added to the basket, the app keeps: what ML Kit read (with positions), what the
// parser filled in, and what the shopper actually added after checking. What was
// added is the right answer, so every scan becomes a marked test example.
//
// Plain functions, shared by the app (Settings) and the computer
// (scripts/scoreScans.ts), so both score in exactly the same way:
//   npx tsx scripts/checkScanLog.ts
// hooks/useScanLog.ts saves the records and photos on the phone.

import type { DealInput } from '../types';
import type { OcrPiece } from './labelParser/extractFromOcr';

export const SCAN_RECORD_VERSION = 1;

// Pass mark for the shelf price, as agreed: right 8 times out of 10
export const PRICE_PASS_MARK = 0.8;

export type DealValue = {
  type: 'price' | 'qty' | null;  // null: "3 for" spotted but not the rest
  qty: number | null;
  price: number | null;          // "3 for €4": 4
  pay: number | null;            // "3 for 2": 2
} | null;

// The three things the reader is judged on
export type Values = {
  price: number | null;
  club_card_price: number | null;
  deal: DealValue;
};

export type ScanRecord = {
  version: number;
  id: string;                  // also the photo's file name, <id>.jpg
  created_at: string;          // ISO date and time
  store: string;
  parser_version: string;      // the parser that read it at the time
  ocr: OcrPiece[];             // what ML Kit read, in the parser's format
  photo: string | null;        // file name of the photo, if it was saved
  read: Values;                // what the parser filled in
  confirmed: Values;           // what the shopper added after checking
  product_name: string;
  barcode: string | null;
};

export function dealValue(d: DealInput | null): DealValue {
  if (!d) return null;
  return { type: d.deal_type, qty: d.deal_qty, price: d.deal_price, pay: d.deal_pay_qty };
}

// Names and dates are safe for file names; the random part avoids clashes
export function newScanId(now: Date, random: number = Math.random()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // 20261112-093015
  return `scan-${stamp}-${Math.floor(random * 1e6).toString(36).padStart(4, '0')}`;
}

const sameMoney = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 0.005;

function sameDeal(a: DealValue, b: DealValue): boolean {
  if (a === null || b === null) return a === b;
  return a.type === b.type && a.qty === b.qty && sameMoney(a.price, b.price) && a.pay === b.pay;
}

// true = right, false = wrong, null = nothing to get right (neither had one)
export type FieldScore = { price: boolean; club: boolean | null; deal: boolean | null };

export function scoreScan(read: Values, confirmed: Values): FieldScore {
  return {
    price: sameMoney(read.price, confirmed.price),
    club: read.club_card_price === null && confirmed.club_card_price === null ? null : sameMoney(read.club_card_price, confirmed.club_card_price),
    deal: read.deal === null && confirmed.deal === null ? null : sameDeal(read.deal, confirmed.deal),
  };
}

export type Tally = { right: number; total: number };
export type StoreSummary = { scans: number; price: Tally; club: Tally; deal: Tally };
export type Summary = StoreSummary & { byStore: Record<string, StoreSummary> };

const empty = (): StoreSummary => ({ scans: 0, price: { right: 0, total: 0 }, club: { right: 0, total: 0 }, deal: { right: 0, total: 0 } });

function add(s: StoreSummary, score: FieldScore) {
  s.scans++;
  s.price.total++;
  if (score.price) s.price.right++;
  if (score.club !== null) { s.club.total++; if (score.club) s.club.right++; }
  if (score.deal !== null) { s.deal.total++; if (score.deal) s.deal.right++; }
}

export function summarise(records: Pick<ScanRecord, 'store' | 'read' | 'confirmed'>[]): Summary {
  const all = { ...empty(), byStore: {} as Record<string, StoreSummary> };
  for (const r of records) {
    const score = scoreScan(r.read, r.confirmed);
    add(all, score);
    add((all.byStore[r.store] ??= empty()), score);
  }
  return all;
}

export const share = (t: Tally) => (t.total === 0 ? null : t.right / t.total);

// "31 of 37 (84%)"
export function tallyText(t: Tally): string {
  return t.total === 0 ? 'none yet' : `${t.right} of ${t.total} (${Math.round((t.right / t.total) * 100)}%)`;
}

export function passesPriceMark(t: Tally): boolean | null {
  const s = share(t);
  return s === null ? null : s >= PRICE_PASS_MARK;
}

// Reading back what was saved: anything damaged is skipped, not trusted
export function readRecord(raw: string): ScanRecord | null {
  try {
    const r = JSON.parse(raw);
    if (!r || typeof r.id !== 'string' || typeof r.store !== 'string' || !Array.isArray(r.ocr) || !r.read || !r.confirmed) return null;
    return r as ScanRecord;
  } catch {
    return null;
  }
}
