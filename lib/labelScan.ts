// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// From what was read on a shelf label to a filled-in confirm card:
// parser → confirm draft → card, plus the product barcode if one is printed.
// Plain functions, tested on the computer:
//   npx tsx scripts/checkLabelScan.ts
// hooks/useLabelScanner.ts takes the photo and runs ML Kit.

import { formFromDraft, type ConfirmForm } from './confirmForm';
import type { OcrPiece } from './labelParser/extractFromOcr';
import { findBarcodes } from './labelParser/findBarcode';
import { parseLabel, PARSER_VERSION } from './labelParser/parseLabel';
import { toConfirmDraft } from './labelParser/toConfirmDraft';

export type LabelScan = {
  form: ConfirmForm;
  notes: string[];          // shown on the confirm card
  barcode: string | null;   // the product barcode printed on the label, if any
  readText: string;         // everything that was read, one piece per line, for checking
  parserVersion: string;
};

export function scanToForm(pieces: OcrPiece[], store: string): LabelScan {
  const parsed = parseLabel(pieces, store);
  const draft = toConfirmDraft(parsed, store);
  const barcode = findBarcodes(pieces)[0] ?? null;
  draft.barcode = barcode;

  const notes =
    pieces.length === 0
      ? ["Couldn't read any text. Try again closer to the label, with good light, or type the price in."]
      : draft.notes;
  return {
    form: formFromDraft(draft),
    notes,
    barcode,
    readText: pieces.map((p) => p[1]).join('\n'),
    parserVersion: PARSER_VERSION,
  };
}
