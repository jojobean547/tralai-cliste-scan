// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Shopping history: finished shops, one per store, grouped by day.
// Plain functions, tested on the computer:
//   npx tsx scripts/checkHistory.ts
// hooks/useHistory.tsx keeps the history on the phone.
//
// A finished shop keeps its items and totals exactly as they were at the till,
// so turning a club card on or off later doesn't change past totals.

import type { BasketItem } from '../types';
import { describeDeal, euro } from './basketDisplay';
import { lineTotal } from './dealCalculator';
import { summarise } from './basket';

type HasClubCard = (cardName: string) => boolean;

export type ShopLine = { item: BasketItem; total: number };

export type Shop = {
  id: string;
  store: string;
  finished_at: string;   // ISO date and time
  lines: ShopLine[];
  total: number;
  item_count: number;
  saving: number;
};

// Keeps history from growing without end: the newest shops are kept
export const HISTORY_MAX = 500;

// The basket, split into one shop per store, in the order the stores were visited
export function shopsFromBasket(items: BasketItem[], hasClubCard: HasClubCard, now: Date, makeId: () => string): Shop[] {
  const stores: string[] = [];
  for (const i of items) if (!stores.includes(i.store_name)) stores.push(i.store_name);
  return stores.map((store) => {
    const mine = items.filter((i) => i.store_name === store);
    const { total, itemCount, saving } = summarise(mine, hasClubCard);
    return {
      id: makeId(),
      store,
      finished_at: now.toISOString(),
      lines: mine.map((item) => ({ item, total: lineTotal(item, hasClubCard) })),
      total,
      item_count: itemCount,
      saving,
    };
  });
}

// "Lidl €23.40" or "Lidl €23.40 and Dunnes Stores €15.10", for the Finish shop question
export function finishSummary(shops: Pick<Shop, 'store' | 'total'>[]): string {
  const parts = shops.map((s) => `${s.store} ${euro(s.total)}`);
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// Newest first; only the newest HISTORY_MAX are kept
export function addShops(history: Shop[], shops: Shop[], max: number = HISTORY_MAX): Shop[] {
  return [...shops, ...history]
    .sort((a, b) => b.finished_at.localeCompare(a.finished_at))
    .slice(0, max);
}

export function removeShop(history: Shop[], id: string): Shop[] {
  return history.filter((s) => s.id !== id);
}

// ─── Grouping by day, in the phone's own time zone ───

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// "Today", "Yesterday", "Mon 9 Nov", or "Fri 12 Dec 2025" for another year
export function dayLabel(d: Date, now: Date): string {
  if (dayKey(d) === dayKey(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

// "18:05"
export function timeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type Day = { key: string; label: string; shops: Shop[]; total: number };

export function groupByDay(history: Shop[], now: Date): Day[] {
  const days: Day[] = [];
  const sorted = [...history].sort((a, b) => b.finished_at.localeCompare(a.finished_at));
  for (const shop of sorted) {
    const d = new Date(shop.finished_at);
    const key = dayKey(d);
    let day = days.find((x) => x.key === key);
    if (!day) {
      day = { key, label: dayLabel(d, now), shops: [], total: 0 };
      days.push(day);
    }
    day.shops.push(shop);
    day.total = Math.round((day.total + shop.total) * 100) / 100;
  }
  return days;
}

// One item of a past shop, as shown in the history: "2 × Heinz Beanz", "3 for 2", "€2.58"
export function describeShopLine(line: ShopLine, position: number): { title: string; deal: string | null; total: string } {
  const name = line.item.product_name.trim() || `Item ${position}`;
  return {
    title: line.item.quantity > 1 ? `${line.item.quantity} × ${name}` : name,
    deal: describeDeal(line.item.deal),
    total: euro(line.total),
  };
}

// Reads the history saved on the phone. Anything damaged is skipped.
export function readSavedHistory(raw: string | null): Shop[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (s): s is Shop =>
        typeof s === 'object' && s !== null &&
        typeof s.id === 'string' && typeof s.store === 'string' &&
        typeof s.finished_at === 'string' && !Number.isNaN(Date.parse(s.finished_at)) &&
        typeof s.total === 'number' && Array.isArray(s.lines),
    );
  } catch {
    return [];
  }
}
