// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Finding the product barcode printed on a shelf label, in the OCR text.
// Plain functions, tested on the computer:
//   npx tsx scripts/checkFindBarcode.ts
//
// Only numbers whose check digit adds up are kept, so a misread barcode is
// dropped rather than looked up wrongly.

import { isValidBarcode } from '../barcode';
import type { OcrPiece } from './extractFromOcr';

// 'product'   = a normal barcode, the same in every shop (e.g. 539… Ireland, 50… UK)
// 'storeCode' = a shop's own in-store code (8 digits starting with 2, or 13 digits
//               starting with 2 or 02). Often used for own-brand and loose items,
//               so it may not be in Open Food Facts.
export type BarcodeKind = 'product' | 'storeCode';

// Some labels print an 8-digit barcode padded to 13 digits, e.g.
// 0000020106331 is really 20106331. The padding doesn't change the check digit.
export function normaliseBarcode(digits: string): string {
  if (digits.length === 13 && digits.startsWith('00000')) return digits.slice(5);
  return digits;
}

export function barcodeKind(code: string): BarcodeKind {
  if (code.length === 8 && code.startsWith('2')) return 'storeCode';
  if (code.length === 13 && (code.startsWith('2') || code.startsWith('02'))) return 'storeCode';
  return 'product';
}

// Every valid barcode on the label, in reading order, without repeats.
// Spaces and dashes inside one piece of text are ignored ("5 012345 678900").
export function findBarcodes(pieces: OcrPiece[]): string[] {
  const out: string[] = [];
  for (const [, text] of pieces) {
    const joined = text.replace(/[\s-]/g, '');
    for (const m of joined.matchAll(/\d{8,14}/g)) {
      const code = m[0];
      if (!isValidBarcode(code)) continue;
      const norm = normaliseBarcode(code);
      if (!out.includes(norm)) out.push(norm);
    }
  }
  return out;
}
