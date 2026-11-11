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

import type { OcrPiece } from './extractFromOcr';

// The shape ML Kit returns (only the parts used here)
export type MlRect = { left: number; top: number; right: number; bottom: number };
export type MlWord = { text: string; frame: MlRect };
export type MlLine = { text: string; frame: MlRect; elements: MlWord[] };
export type MlText = { text: string; blocks: { lines: MlLine[] }[] };

// A word this much taller than another in the same line means mixed print sizes
const MIXED_SIZE_RATIO = 1.5;

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
  return pieces.sort((a, b) => top(a) - top(b) || left(a) - left(b));
}
