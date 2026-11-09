// Scores the app's parser against the ground truth, per store and per field,
// using the capstone's frozen scorer, and compares it with the capstone baseline.
//
// Run from the project folder:
//   npx tsx scripts/scoreParser.ts            summary tables
//   npx tsx scripts/scoreParser.ts Dunnes     also list every Dunnes label still wrong

import { readFileSync } from 'node:fs';
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
