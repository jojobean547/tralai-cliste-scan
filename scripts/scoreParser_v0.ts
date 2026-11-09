// Scores the TypeScript parser against the ground truth, per store and per field,
// using the capstone's frozen scorer.
//
// Run from the project folder:
//   npx tsx scripts/scoreParser.ts            summary tables
//   npx tsx scripts/scoreParser.ts Dunnes     also list every Dunnes label it got wrong

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractFromOcr, type OcrPiece } from '../lib/labelParser/extractFromOcr';
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
const truth = readCsv(join(DATA, 'ground_truth.csv'));

type Scored = {
  gt: Record<string, string>;
  res: Record<string, unknown>;
  ok: Record<string, boolean>;
};

const scored: Scored[] = truth.map((gt) => {
  const res = extractFromOcr(ocr[gt.image_filename] ?? []) as unknown as Record<string, unknown>;
  const ok: Record<string, boolean> = {};
  for (const f of ALL_FIELDS) ok[f] = fieldMatch(gt, res as Record<string, never>, f);
  ok.deal = DEAL_FIELDS.every((f) => ok[f]);
  ok.whole = APP_FIELDS.every((f) => ok[f]);
  return { gt, res, ok };
});

const pct = (part: number, total: number) => (total === 0 ? '   –  ' : `${((100 * part) / total).toFixed(1).padStart(5)}%`);
const rate = (rows: Scored[], key: string) => pct(rows.filter((r) => r.ok[key]).length, rows.length);

// ---- 1. Check the scorer port against the capstone notebook ----
const holdout = scored.filter((r) => r.gt.dev_set.toUpperCase() !== 'TRUE');
const allFieldRate = (rows: Scored[]) => {
  const total = rows.length * ALL_FIELDS.length;
  const right = rows.reduce((n, r) => n + ALL_FIELDS.filter((f) => r.ok[f]).length, 0);
  return pct(right, total);
};
console.log('Scorer check (should equal the capstone notebook: 85.9% and 85.4%)');
console.log(`  all 11 fields, all 207 labels: ${allFieldRate(scored)}`);
console.log(`  all 11 fields, 181 holdout:    ${allFieldRate(holdout)}\n`);

// ---- 2. Per store, the fields the app uses ----
const stores = [...new Set(scored.map((r) => r.gt.store))].sort();
console.log('Store       Labels   Price   Club price*   Deal**   Whole label');
for (const store of [...stores, 'ALL']) {
  const rows = store === 'ALL' ? scored : scored.filter((r) => r.gt.store === store);
  const withClub = rows.filter((r) => r.gt.clubcard_price !== '');
  const withDeal = rows.filter((r) => r.gt.deal_type !== '');
  const club = withClub.length ? `${rate(withClub, 'clubcard_price')} of ${String(withClub.length).padStart(2)}` : '     –      ';
  const deal = withDeal.length ? `${rate(withDeal, 'deal')} of ${String(withDeal.length).padStart(2)}` : '     –      ';
  if (store === 'ALL') console.log('-'.repeat(72));
  console.log(
    `${store.padEnd(11)} ${String(rows.length).padStart(5)}   ${rate(rows, 'standard_price')}  ${club}  ${deal}  ${rate(rows, 'whole')}`,
  );
}
console.log('\n*  only labels that have a club price    ** only labels that have a deal (type, qty and price all right)');

// ---- 3. Optional: list one store's failures ----
const listStore = process.argv[2];
if (listStore) {
  const rows = scored.filter((r) => r.gt.store.toLowerCase() === listStore.toLowerCase() && !r.ok.whole);
  console.log(`\n${listStore}: ${rows.length} label(s) with the price, club price or deal wrong\n`);
  const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
  for (const r of rows) {
    console.log(r.gt.image_filename);
    for (const f of APP_FIELDS) {
      if (!r.ok[f]) console.log(`   ${f.padEnd(15)} read: ${show(r.res[f]).padEnd(8)} true: ${show(r.gt[f])}`);
    }
  }
}
