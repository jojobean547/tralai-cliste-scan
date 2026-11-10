// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// What a barcode look-up does to the confirm card, and the messages the shopper
// sees. Plain functions, tested on the computer:
//   npx tsx scripts/checkOff.ts
// hooks/useScanScreen.ts calls these; hooks/useProductLookup.ts does the look-up.

import type { ConfirmForm } from './confirmForm';
import type { LookupProduct } from './openFoodFacts';

// idle → loading → found / notFound / unavailable
// invalid = the barcode numbers don't add up, so nothing was looked up
export type LookupStatus = 'idle' | 'loading' | 'found' | 'notFound' | 'unavailable' | 'invalid';

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');

// The name for the card: brand + name + size, without saying anything twice.
//   Heinz / "Baked Beans" / "415 g"  →  "Heinz Baked Beans 415 g"
//   Heinz / "Heinz Beanz" / "415 g"  →  "Heinz Beanz 415 g"
//   –     / "Beans 415g"  / "415 g"  →  "Beans 415g"
export function nameForCard(p: LookupProduct): string {
  const name = p.product_name;
  const parts: string[] = [];
  if (p.brand && !squash(name).includes(squash(p.brand))) parts.push(p.brand);
  if (name) parts.push(name);
  if (p.quantity && !squash(name).includes(squash(p.quantity))) parts.push(p.quantity);
  return parts.join(' ');
}

// Fill the card from a look-up. A name the shopper already typed is kept;
// the photo and the cleaned-up barcode always come from the look-up.
export function applyProduct(form: ConfirmForm, p: LookupProduct): ConfirmForm {
  return {
    ...form,
    name: form.name.trim() !== '' ? form.name : nameForCard(p),
    imageUrl: p.image_url ?? form.imageUrl,
    barcodeText: p.barcode,
  };
}

export function lookupMessage(status: LookupStatus): string | null {
  switch (status) {
    case 'found':
      return 'Found it. Check the name below.';
    case 'notFound':
      return "This product isn't in Open Food Facts yet. You can type the name yourself.";
    case 'unavailable':
      return "Couldn't reach the product database. Check your signal and try again, or type the name yourself.";
    case 'invalid':
      return 'Check the barcode numbers first.';
    default:
      return null;
  }
}
