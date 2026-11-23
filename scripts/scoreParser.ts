// Scores the app's parser against the ground truth, per store and per field,
// using the capstone's frozen scorer, and compares it with the capstone baseline.
//
// Run from the project folder:
//   npx tsx scripts/scoreParser.ts            summary tables
//   npx tsx scripts/scoreParser.ts Dunnes     also list every Dunnes label still wrong
// It also sorts every shelf price the app parser got blank or wrong by cause
// (OCR or rules), and writes them to scripts/output/price_failures.csv.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractFromOcr, type OcrPiece, type ParsedLabel } from '../lib/labelParser/extractFromOcr';
import { PARSER_VERSION, parseLabel } from '../lib/labelParser/parseLabel';
import { readCsv } from './csv';
import { fieldMatch } from './frozenScorer';

const DATA = join(process.cwd(), 'parser-data');

const ALL_FIELDS = [
  'standard_price', 'clubcard_price', 'has_clubcard_price', 'deal_type', 'deal_qty',
  'deal_price', 'unit_price', 'unit', 'deposit_price', 'weight_volume', 'item_text',
];
const DEAL_FIELDS = ['deal_type', 'deal_qty', 'deal_price'];
const APP_FIELDS = ['standard_price', 'clubcard_price', ...DEAL_FIELDS];

const ocr: Record<string, OcrPiece[]> = JSON.parse(readFileSync(join(DATA, 'p2b_ocr_raw.json'), 'utf-8'));
const capstoneTruth = readCsv(join(DATA, 'ground_truth_capstone.csv')); // frozen, never edited
const truth = readCsv(join(DATA, 'ground_truth.csv'));                  // app copy, see ground_truth_changes.md

type Scored = { gt: Record<string, string>; res: Record<string, unknown>; ok: Record<string, boolean> };

function score(rows: Record<string, string>[], parse: (gt: Record<string, string>) => ParsedLabel): Scored[] {
  return rows.map((gt) => {
    const res = parse(gt) as unknown as Record<string, never>;
    const ok: Record<string, boolean> = {};
    for (const f of ALL_FIELDS) ok[f] = fieldMatch(gt, res, f);
    ok.deal = DEAL_FIELDS.every((f) => ok[f]);
    ok.whole = APP_FIELDS.every((f) => ok[f]);
    return { gt, res, ok };
  });
}

const baselineParse = (gt: Record<string, string>) => extractFromOcr(ocr[gt.image_filename] ?? []);
const appParse = (gt: Record<string, string>) => parseLabel(ocr[gt.image_filename] ?? [], gt.store);

const share = (rows: Scored[], key: string) => (rows.length ? rows.filter((r) => r.ok[key]).length / rows.length : NaN);
const pct = (x: number) => (Number.isNaN(x) ? '  –  ' : `${(100 * x).toFixed(0).padStart(3)}%`);
const change = (before: number, after: number) => (Number.isNaN(after) ? '            ' : `${pct(before)} → ${pct(after)}`);

// ---- 1. Check the scorer still matches the capstone notebook ----
const check = score(capstoneTruth, baselineParse);
const allFields = (rows: Scored[]) =>
  (100 * rows.reduce((n, r) => n + ALL_FIELDS.filter((f) => r.ok[f]).length, 0)) / (rows.length * ALL_FIELDS.length);
const holdout = check.filter((r) => r.gt.dev_set.toUpperCase() !== 'TRUE');
console.log('Scorer check, capstone baseline (should be 85.9% and 85.4%)');
console.log(`  all 207 labels: ${allFields(check).toFixed(1)}%    181 holdout: ${allFields(holdout).toFixed(1)}%\n`);

// ---- 2. Baseline → app parser, per store ----
const before = score(truth, baselineParse);
const after = score(truth, appParse);
console.log(`App parser ${PARSER_VERSION} compared with the capstone baseline (all 207 labels)\n`);
console.log('Store       Labels   Price          Club price*     Deal**          Whole label');
const stores = [...new Set(truth.map((r) => r.store))].sort();
for (const store of [...stores, 'ALL']) {
  const pick = (rows: Scored[]) => (store === 'ALL' ? rows : rows.filter((r) => r.gt.store === store));
  const [b, a] = [pick(before), pick(after)];
  const club = (rows: Scored[]) => rows.filter((r) => r.gt.clubcard_price !== '');
  const deal = (rows: Scored[]) => rows.filter((r) => r.gt.deal_type !== '');
  if (store === 'ALL') console.log('-'.repeat(84));
  console.log(
    `${store.padEnd(11)} ${String(a.length).padStart(5)}   ` +
    `${change(share(b, 'standard_price'), share(a, 'standard_price'))}   ` +
    `${change(share(club(b), 'clubcard_price'), share(club(a), 'clubcard_price'))}    ` +
    `${change(share(deal(b), 'deal'), share(deal(a), 'deal'))}    ` +
    `${change(share(b, 'whole'), share(a, 'whole'))}`,
  );
}
console.log('\n*  only labels that have a club price   ** only labels that have a deal (type, qty and price all right)');

// How the shelf price goes wrong matters on the confirm card: a blank is
// obvious to the shopper, a wrong number has to be spotted.
const outcome = (rows: Scored[]) => {
  const right = rows.filter((r) => r.ok.standard_price).length;
  const blank = rows.filter((r) => !r.ok.standard_price && (r.res.standard_price ?? null) === null).length;
  return `${right} right, ${blank} left blank, ${rows.length - right - blank} wrong number`;
};
console.log(`\nShelf price, baseline:   ${outcome(before)}`);
console.log(`Shelf price, app parser: ${outcome(after)}`);

// ---- 3. Optional: list one store's remaining failures ----
const listStore = process.argv[2];
if (listStore) {
  const rows = after.filter((r) => r.gt.store.toLowerCase() === listStore.toLowerCase() && !r.ok.whole);
  console.log(`\n${listStore}: ${rows.length} label(s) with the price, club price or deal still wrong\n`);
  const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
  for (const r of rows) {
    console.log(r.gt.image_filename);
    for (const f of APP_FIELDS) {
      if (!r.ok[f]) console.log(`   ${f.padEnd(15)} read: ${show(r.res[f]).padEnd(8)} true: ${show(r.gt[f])}`);
    }
  }
}

// ---- 4. Why the shelf price is blank or wrong: the OCR, or the rules? ----
// Each failure goes in exactly one category:
//   OCR_MISSED          blank, and the right price isn't anywhere in the OCR text
//   RULES_MISSED        blank, but the right price is in the OCR text
//   RULES_PICKED_WRONG  wrong number, and the right price is in the OCR text
//   OCR_MISREAD         wrong number, and the right price isn't in the OCR text
// Every label in the ground truth has a shelf price (for weighed items too, though
// per kg and per item can be hard to tell apart). If one ever had none and the parser
// gave a number, it would count as RULES_PICKED_WRONG.

type Category = 'OCR_MISSED' | 'RULES_MISSED' | 'RULES_PICKED_WRONG' | 'OCR_MISREAD';
const CATEGORIES: Category[] = ['OCR_MISSED', 'RULES_MISSED', 'RULES_PICKED_WRONG', 'OCR_MISREAD'];

// Does the price appear in what the OCR read, in any common form?
//   2.49  2,49  €2.49  249  "2 49" (superscript cents as separate text)
// and for prices under €1 also 99c and .99
function priceInOcr(price: number, pieces: OcrPiece[]): boolean {
  const [euros, cents] = price.toFixed(2).split('.');
  const texts = pieces.map((p) => p[1].trim());
  const joined = texts.join(' ');
  const forms = [
    new RegExp(String.raw`(?<![\d.,])${euros}[.,]${cents}(?!\d)`),     // 2.49, 2,49, €2.49
    new RegExp(String.raw`(?<![\d.,])${euros}${cents}(?![\d.,])`),      // 249
    new RegExp(String.raw`(?<![\d.,])${euros}\s+${cents}(?![\d.,])`),   // 2 49 in a row
  ];
  if (euros === '0') {
    forms.push(new RegExp(String.raw`(?<![\d.,])${cents}\s*c\b`, 'i')); // 99c
    forms.push(new RegExp(String.raw`(?<![\d])[.,]${cents}(?!\d)`));     // .99
  }
  if (forms.some((re) => re.test(joined))) return true;
  // "€2" and "49" read as separate pieces, not next to each other in reading order
  const hasEuros = texts.some((t) => new RegExp(String.raw`^€?\s*${euros}[.,]?$`).test(t));
  const hasCents = texts.some((t) => new RegExp(String.raw`^[.,]?${cents}$`).test(t));
  return hasEuros && hasCents;
}

const failures = after
  .filter((r) => !r.ok.standard_price)
  .map((r) => {
    const pieces = ocr[r.gt.image_filename] ?? [];
    const parsed = (r.res.standard_price ?? null) as number | null;
    const truePrice = r.gt.standard_price === '' ? null : Number(r.gt.standard_price);
    const inOcr = truePrice !== null && priceInOcr(truePrice, pieces);
    const category: Category =
      parsed === null
        ? (inOcr ? 'RULES_MISSED' : 'OCR_MISSED')
        : (inOcr || truePrice === null ? 'RULES_PICKED_WRONG' : 'OCR_MISREAD');
    return {
      label_id: r.gt.image_filename,
      store: r.gt.store,
      true_price: truePrice === null ? '' : truePrice.toFixed(2),
      parsed_price: parsed === null ? '' : parsed.toFixed(2),
      category,
      ocr_text: pieces.map((p) => p[1]).join(' | '),
    };
  });

console.log(`\nShelf price failures by cause, app parser ${PARSER_VERSION} (${failures.length} of ${after.length} labels)\n`);
const col = (t: string, w: number) => t.padStart(w);
console.log(`${'Store'.padEnd(11)}${CATEGORIES.map((c) => col(c, 20)).join('')}${col('Total', 8)}`);
for (const store of [...stores, 'ALL']) {
  const mine = store === 'ALL' ? failures : failures.filter((f) => f.store === store);
  if (store === 'ALL') console.log('-'.repeat(11 + 20 * CATEGORIES.length + 8));
  console.log(`${store.padEnd(11)}${CATEGORIES.map((c) => col(String(mine.filter((f) => f.category === c).length), 20)).join('')}${col(String(mine.length), 8)}`);
}
for (const c of CATEGORIES) {
  const ids = failures.filter((f) => f.category === c).map((f) => f.label_id);
  console.log(`\n${c} (${ids.length})`);
  if (ids.length) console.log(`  ${ids.join(', ')}`);
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const CSV_COLUMNS = ['label_id', 'store', 'true_price', 'parsed_price', 'category', 'ocr_text'] as const;
const outDir = join(process.cwd(), 'scripts', 'output');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'price_failures.csv'),
  [CSV_COLUMNS.join(','), ...failures.map((f) => CSV_COLUMNS.map((k) => csvCell(f[k])).join(','))].join('\n') + '\n',
  'utf-8',
);
console.log('\nPer-label rows written to scripts/output/price_failures.csv');
