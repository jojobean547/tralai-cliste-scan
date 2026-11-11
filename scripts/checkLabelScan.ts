// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Checks reading a shelf label photo on the phone, without the phone:
//  - turning ML Kit's output into parser pieces (lib/labelParser/fromMlKit.ts)
//  - filling the confirm card from them (lib/labelScan.ts)
//  - that the conversion keeps the parser's results on the 207 development labels
//   npx tsx scripts/checkLabelScan.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OcrPiece } from '../lib/labelParser/extractFromOcr';
import { mlKitToOcr, type MlLine, type MlRect, type MlText } from '../lib/labelParser/fromMlKit';
import { parseLabel } from '../lib/labelParser/parseLabel';
import { scanToForm } from '../lib/labelScan';
import { readCsv } from './csv';

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

const rect = (left: number, top: number, right: number, bottom: number): MlRect => ({ left, top, right, bottom });
const word = (text: string, r: MlRect) => ({ text, frame: r });
const line = (text: string, r: MlRect, words = [word(text, r)]): MlLine => ({ text, frame: r, elements: words });
const ml = (...lines: MlLine[]): MlText => ({ text: lines.map((l) => l.text).join('\n'), blocks: [{ lines }] });

// ─── Converting ML Kit's output ───
const simple = mlKitToOcr(ml(line('€1.29', rect(100, 200, 400, 320)), line('Heinz Beans 415g', rect(80, 40, 600, 90))));
expect('one piece per line', simple.map((p) => p[1]), ['Heinz Beans 415g', '€1.29']);
expect('rectangle becomes four corners', simple[1][0], [[100, 200], [400, 200], [400, 320], [100, 320]]);
expect('confidence set to 1', simple[0][2], 1);

const tesco = mlKitToOcr(ml(line('€8 35', rect(100, 100, 460, 300), [word('€8', rect(100, 100, 330, 300)), word('35', rect(340, 110, 460, 200))])));
expect('big euros + small cents split into words', tesco.map((p) => p[1]), ['€8', '35']);
const sameSize = mlKitToOcr(ml(line('2 for €5', rect(0, 0, 300, 60), [word('2', rect(0, 0, 40, 60)), word('for', rect(50, 5, 120, 55)), word('€5', rect(130, 0, 200, 60))])));
expect('same-size words stay one line', sameSize.map((p) => p[1]), ['2 for €5']);
expect('empty and zero-size lines dropped', mlKitToOcr(ml(line('  ', rect(0, 0, 10, 10)), line('x', rect(5, 5, 5, 9)))), []);
expect('nothing read', mlKitToOcr({ text: '', blocks: [] }), []);

// ─── Filling the card ───
const card = scanToForm(mlKitToOcr(ml(
  line('Heinz Beanz 415g', rect(40, 20, 700, 80)),
  line('€1.29', rect(60, 120, 520, 330)),
  line('€3.11/kg', rect(60, 360, 300, 400)),
  line('5000157024671', rect(400, 420, 760, 460)),
)), 'Centra');
expect('card: shelf price', card.form.priceText, '1.29');
expect('card: barcode from the label', [card.barcode, card.form.barcodeText], ['5000157024671', '5000157024671']);
expect('card: no deal', card.form.dealChoice, 'none');
expect('card: what was read kept for checking', card.readText.split('\n').length, 4);

const tescoCard = scanToForm(mlKitToOcr(ml(
  line('Any 2', rect(500, 40, 700, 110)),
  line('for €5', rect(500, 120, 700, 190)),
  line('€3 50', rect(40, 60, 420, 260), [word('€3', rect(40, 60, 260, 260)), word('50', rect(270, 70, 420, 160))]),
)), 'Tesco');
expect('Tesco card: cents joined back', tescoCard.form.priceText, '3.50');
expect('Tesco card: Any 2 for €5', [tescoCard.form.dealChoice, tescoCard.form.dealQtyText, tescoCard.form.dealPriceText], ['price', '2', '5.00']);

const blank = scanToForm([], 'Lidl');
expect('nothing read: one clear note', blank.notes.length === 1 && blank.notes[0].startsWith("Couldn't read any text"), true);
expect('nothing read: empty card', blank.form.priceText, '');

// ─── The 207 development labels, through ML Kit's format and back ───
// PaddleOCR's boxes are turned into ML Kit-style rectangles (as ML Kit would
// report them) and read back. The shelf price should come out the same.
const DATA = join(process.cwd(), 'parser-data');
const ocr: Record<string, OcrPiece[]> = JSON.parse(readFileSync(join(DATA, 'p2b_ocr_raw.json'), 'utf-8'));
const truth = new Map(readCsv(join(DATA, 'ground_truth.csv')).map((r) => [r.image_filename, r]));

const asMlKit = (pieces: OcrPiece[]): MlText => ({
  text: '',
  blocks: [{
    lines: pieces.map(([box, text]) => {
      const xs = box.map((p) => p[0]);
      const ys = box.map((p) => p[1]);
      const r = rect(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      return line(text, r);
    }),
  }],
});

let same = 0;
let rightBefore = 0;
let rightAfter = 0;
const images = Object.keys(ocr);
for (const image of images) {
  const store = truth.get(image)?.store ?? image.split('_')[0];
  const want = truth.get(image)?.standard_price ?? '';
  const before = parseLabel(ocr[image], store).standard_price;
  const after = parseLabel(mlKitToOcr(asMlKit(ocr[image])), store).standard_price;
  if (before === after) same++;
  if (want !== '' && before !== null && Math.abs(before - Number(want)) < 0.005) rightBefore++;
  if (want !== '' && after !== null && Math.abs(after - Number(want)) < 0.005) rightAfter++;
}
console.log(`\n  Shelf price unchanged by the conversion: ${same} of ${images.length}`);
console.log(`  Shelf price right: ${rightBefore} before, ${rightAfter} after`);
expect('conversion keeps the shelf price on at least 97% of labels', same / images.length >= 0.97, true);
expect('conversion does not lower the price score', rightAfter >= rightBefore - 2, true);

console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) failed`);
if (failures > 0) process.exit(1);
