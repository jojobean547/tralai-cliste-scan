// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Checks finding barcodes on shelf labels (lib/labelParser/findBarcode.ts) and
// the comparison rules used by scripts/checkShelfBarcodes.ts. No internet needed.
//   npx tsx scripts/checkFindBarcode.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OcrPiece } from '../lib/labelParser/extractFromOcr';
import { barcodeKind, findBarcodes, normaliseBarcode } from '../lib/labelParser/findBarcode';
import { keyWords, nameScore, nameVerdict, packCount, parseSize, sizeVerdict } from './offMatch';

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}
const piece = (text: string): OcrPiece => [[[0, 0], [1, 0], [1, 1], [0, 1]], text, 0.99];

// ─── Finding barcodes ───
expect('a 13-digit barcode', findBarcodes([piece('Beans'), piece('5000157024671')]), ['5000157024671']);
expect('spaces inside are ignored', findBarcodes([piece('5 000157 024671')]), ['5000157024671']);
expect('wrong check digit dropped', findBarcodes([piece('5000157024672')]), []);
expect('prices and short numbers ignored', findBarcodes([piece('€1.29'), piece('812849')]), []);
expect('the same barcode twice kept once', findBarcodes([piece('5000157024671'), piece('5000157024671')]), ['5000157024671']);
expect('padded 8-digit unpadded', normaliseBarcode('0000020106331'), '20106331');
expect('normal 13 digits unchanged', normaliseBarcode('5099874362609'), '5099874362609');

expect('Irish barcode is a product', barcodeKind('5391234567890'), 'product');
expect('8 digits starting with 2 is a store code', barcodeKind('20106331'), 'storeCode');
expect('13 digits starting with 2 is a store code', barcodeKind('2058262000007'), 'storeCode');
expect('13 digits starting with 02 is a store code', barcodeKind('0228170000000'), 'storeCode');
expect('8 digits starting with 0 is a store code', barcodeKind('03251416'), 'storeCode');
expect('13 digits starting with 04 is a store code', barcodeKind('0412345678901'), 'storeCode');
expect('other 8 digits is a product', barcodeKind('53994363'), 'product');
expect('German 400 is a product, not a store code', barcodeKind('4005808837311'), 'product');
expect('American 0… 13 digits is a product', barcodeKind('0012345678905'), 'product');

// On the real development labels
const ocr: Record<string, OcrPiece[]> = JSON.parse(readFileSync(join(process.cwd(), 'parser-data', 'p2b_ocr_raw.json'), 'utf-8'));
const withBarcode = Object.values(ocr).filter((p) => findBarcodes(p).length > 0).length;
expect('84 of the 207 labels have a barcode', [withBarcode, Object.keys(ocr).length], [84, 207]);
expect('no label has two', Object.values(ocr).every((p) => findBarcodes(p).length <= 1), true);

// ─── Comparing names ───
expect('key words', keyWords("The Juice Company Orange / Apple Juice 330ml"), ['juice', 'company', 'orange', 'apple']);
expect('accents dropped', keyWords('Café Crème'), ['cafe', 'creme']);
expect('same product', nameScore("Nature's Pick Peaches", 'Natures Pick Peaches in Juice 4 pack'), 1);
expect('run-together words still match', nameScore("Nature's Pick Peaches", 'NATURESPICK PEACHES'), 1);
expect('half the words', nameScore('Simply Better Hazelnut Spread', 'Hazelnut Spread'), 0.5);
expect('different product', nameScore('Brennans Bread', 'Heinz Baked Beans'), 0);
expect('verdicts', [nameVerdict(1), nameVerdict(0.5), nameVerdict(0.6), nameVerdict(0.2)], ['match', 'partial', 'match', 'different']);

// ─── Comparing sizes ───
expect('500gm', parseSize('500gm'), { total: 500, each: 500, unit: 'g' });
expect('675grm', parseSize('675grm'), { total: 675, each: 675, unit: 'g' });
expect('1kgm', parseSize('1kgm'), { total: 1000, each: 1000, unit: 'g' });
expect('0.5 kg', parseSize('0.5 kg'), { total: 500, each: 500, unit: 'g' });
expect('72mls', parseSize('72mls'), { total: 72, each: 72, unit: 'ml' });
expect('33cl', parseSize('33cl'), { total: 330, each: 330, unit: 'ml' });
expect('1ltr', parseSize('1ltr'), { total: 1000, each: 1000, unit: 'ml' });
expect('2 litre', parseSize('2 litre'), { total: 2000, each: 2000, unit: 'ml' });
expect('4 x 125g', parseSize('4 x 125g'), { total: 500, each: 125, unit: 'g' });
expect('6x330ml', parseSize('6x330ml'), { total: 1980, each: 330, unit: 'ml' });
expect('drained weight: first size', parseSize('400g/ 240g drained weight'), { total: 400, each: 400, unit: 'g' });
expect('6 pack has no size', parseSize('6 pack'), null);
expect('10m of foil has no size', parseSize('10m'), null);
expect('same size', sizeVerdict('500gm', '500 g'), 'same');
expect('same size, other units', sizeVerdict('1ltr', '1000 ml'), 'same');
expect('different size', sizeVerdict('400g', '415 g'), 'different');
expect("can't tell", sizeVerdict('6 pack', '6'), 'unknown');
expect('multipack total matches', sizeVerdict('4 x 125g', '500 g'), 'same');
expect('multipack single matches', sizeVerdict('4 x 125g', '125 g'), 'same');
expect("grams vs ml can't be compared", sizeVerdict('90mls', '62g'), 'unknown');
expect('rounded on the label', sizeVerdict('72mls', '72,5 ml'), 'same');
expect('a real difference', sizeVerdict('600gm', '500g'), 'different');
expect('4pk label shows one bar', sizeVerdict('27grm', '108g', 'Aero Bubbly Bar Pep/M 4pk'), 'same');
expect('no pack count, no excuse', sizeVerdict('27grm', '108g', 'Aero Bubbly Bar'), 'different');
expect('pack counts', [packCount('Curly Wurly 4pk'), packCount('Soft Buns 4\'s'), packCount('6 Pack'), packCount('Tea 80\'s'), packCount('Beans')], [4, 4, 6, null, null]);

console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) failed`);
if (failures > 0) process.exit(1);
