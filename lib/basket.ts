// The basket's rules, as plain functions with no screens or storage involved,
// so they can be tested on the computer: npx tsx scripts/checkBasket.ts
// hooks/useBasket.tsx wires these up to the app.

import type { BasketItem } from '../types';
import { basketTotal, lineSaving } from './dealCalculator';

type HasClubCard = (cardName: string) => boolean;

// A unique id for each basket line. There are no barcodes any more,
// so two scans of the same label become two lines unless the shopper
// changes the quantity instead.
export function newLineId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addLine(items: BasketItem[], item: BasketItem): BasketItem[] {
  return [...items, item];
}

export function removeLine(items: BasketItem[], id: string): BasketItem[] {
  return items.filter((i) => i.id !== id);
}

// Quantity 0 or less removes the line
export function setQuantity(items: BasketItem[], id: string, quantity: number): BasketItem[] {
  if (quantity <= 0) return removeLine(items, id);
  return items.map((i) => (i.id === id ? { ...i, quantity: Math.floor(quantity) } : i));
}

// For correcting a line after it was added (e.g. the price was misread)
export function updateLine(items: BasketItem[], id: string, changes: Partial<Omit<BasketItem, 'id'>>): BasketItem[] {
  return items.map((i) => (i.id === id ? { ...i, ...changes } : i));
}

export function summarise(items: BasketItem[], hasClubCard: HasClubCard) {
  return {
    total: basketTotal(items, hasClubCard),
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    saving: Math.round(items.reduce((s, i) => s + lineSaving(i, hasClubCard), 0) * 100) / 100,
  };
}

// Reads a basket saved on the phone. Anything damaged or from an older
// version of the app is skipped rather than crashing the app.
export function readSavedBasket(raw: string | null): BasketItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (i): i is BasketItem =>
        typeof i === 'object' && i !== null &&
        typeof i.id === 'string' &&
        typeof i.price === 'number' && i.price >= 0 &&
        typeof i.quantity === 'number' && i.quantity > 0 &&
        typeof i.store_name === 'string',
    );
  } catch {
    return [];
  }
}
