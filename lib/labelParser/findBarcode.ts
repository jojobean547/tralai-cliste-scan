// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Finding the product barcode printed on a shelf label, in the OCR text.
// Plain functions, tested on the computer:
//   npx tsx scripts/checkFindBarcode.ts
//
// Only numbers whose check digit adds up are kept, so a misread barcode is
// dropped rather than looked up wrongly.

import { isValidBarcode, normaliseBarcode } from '../barcode';
import type { OcrPiece } from './extractFromOcr';

// The rules for in-store codes and zero padding live in lib/barcode.ts, so the
// app's barcode lookup uses exactly the same ones.
export { barcodeKind, normaliseBarcode, type BarcodeKind } from '../barcode';

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
