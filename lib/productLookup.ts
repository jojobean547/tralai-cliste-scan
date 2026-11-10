// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// What a barcode look-up does to the confirm card, and the messages the shopper
// sees. Plain functions, tested on the computer:
//   npx tsx scripts/checkOff.ts
// hooks/useScanScreen.ts calls these; hooks/useProductLookup.ts does the look-up.

import type { ConfirmForm } from './confirmForm';
import type { LookupProduct } from './openFoodFacts';

// idle → loading → found / suggested / notFound / unavailable
// suggested = found, but the barcode is a shop's own code (lib/barcode.ts), so the
//             same number may be a different product elsewhere. Nothing is filled
//             in until the shopper taps "Use this".
// invalid   = the barcode numbers don't add up, so nothing was looked up
export type LookupStatus = 'idle' | 'loading' | 'found' | 'suggested' | 'notFound' | 'unavailable' | 'invalid';

// The colour of the result box on the confirm card
//   good = green, note = gold, problem = red
export type LookupTone = 'good' | 'note' | 'problem';

export function lookupTone(status: LookupStatus): LookupTone | null {
  switch (status) {
    case 'found':
      return 'good';
    case 'suggested':
    case 'notFound':
    case 'invalid':
      return 'note';
    case 'unavailable':
      return 'problem';
    default:
      return null;
  }
}

// Lower case, letters and numbers only, so "Hellmann's" and "Hellmanns" compare equal
const squash = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
const words = (s: string) => s.split(/\s+/).filter(Boolean);

// The brand to put in front of the name, or '' when the name already has it.
//   "Hellmann's" + "Hellmanns Thousand Island"   → ''            (already there)
//   "Lyons Tea"  + "Lyons Original Blend Tea"     → ''            (starts with the brand's first word)
//   "Biona Organic" + "Organic black beans"       → 'Biona'       (overlap dropped)
//   "Heinz"      + "Baked Beans"                  → 'Heinz'
function brandPrefix(brand: string, name: string): string {
  const b = words(brand);
  const n = squash(name);
  const nameWords = words(name).map(squash);
  // Whole words only: "Choco" is not already in "Chocolate"
  if (b.length === 0 || n.includes(squash(brand)) || nameWords.includes(squash(b[0]))) return '';
  // Drop brand words the name already starts with ("Organic" in "Biona Organic" + "Organic …")
  for (let k = Math.min(b.length - 1, nameWords.length); k > 0; k--) {
    if (b.slice(b.length - k).map(squash).join(' ') === nameWords.slice(0, k).join(' ')) return b.slice(0, b.length - k).join(' ');
  }
  return brand;
}

// Open Food Facts sometimes has a bare number as the size ("1", "150"); only
// sizes with a unit ("415 g", "4 x 21.5g", "1 litre") are worth showing.
const hasUnit = (q: string) => /\d/.test(q) && /[a-z]/i.test(q);

// The name for the card: brand + name + size, without saying anything twice.
//   Heinz / "Baked Beans" / "415 g"   →  "Heinz Baked Beans 415 g"
//   Heinz / "Heinz Beanz" / "415 g"   →  "Heinz Beanz 415 g"
//   –     / "Beans 415g"  / "415 g"   →  "Beans 415g"
//   Nestlé / "Smarties"   / "1"       →  "Nestlé Smarties"
export function nameForCard(p: LookupProduct): string {
  const name = p.product_name;
  const parts: string[] = [];
  const brand = p.brand ? brandPrefix(p.brand, name) : '';
  if (brand) parts.push(brand);
  if (name) parts.push(name);
  if (p.quantity && hasUnit(p.quantity) && !squash(name).includes(squash(p.quantity))) parts.push(p.quantity);
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
    case 'suggested':
      return "Is this the right product? This is the shop's own code, and the same number can be a different product in another shop.";
    default:
      return null;
  }
}
