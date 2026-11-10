// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Looks up every barcode printed on the 207 development labels in Open Food
// Facts, using the app's own lookup (services/productService.ts), and compares
// what comes back with the ground truth (brand, item name, size).
//
// Needs the internet. Run from the project folder:
//   npx tsx scripts/checkShelfBarcodes.ts          all 84 barcodes (about 4 minutes)
//   npx tsx scripts/checkShelfBarcodes.ts retry    only the ones that were unreachable last time
//
// It asks politely: one barcode at a time, every 3 seconds, with the app's
// User-Agent. Open Food Facts allows about 100 product requests a minute, and
// one barcode can take up to three (food, beauty, household).
// Writes the full list to parser-data/off_shelf_barcodes.csv and prints a summary.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { barcodeKind, findBarcodes } from '../lib/labelParser/findBarcode';
import type { OcrPiece } from '../lib/labelParser/extractFromOcr';
import { nameForCard } from '../lib/productLookup';
import { fetchProduct } from '../services/productService';
import { readCsv } from './csv';
import { nameScore, nameVerdict, sizeVerdict } from './offMatch';

const DATA = join(process.cwd(), 'parser-data');
const OUT = join(DATA, 'off_shelf_barcodes.csv');
const PAUSE_MS = 3000;
const RETRY = process.argv[2] === 'retry';

const ocr: Record<string, OcrPiece[]> = JSON.parse(readFileSync(join(DATA, 'p2b_ocr_raw.json'), 'utf-8'));
const truth = new Map(readCsv(join(DATA, 'ground_truth.csv')).map((r) => [r.image_filename, r]));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = Record<string, string>;
const COLUMNS = [
  'image', 'store', 'barcode', 'kind', 'result', 'database',
  'label_name', 'off_name', 'name_score', 'name_verdict',
  'label_size', 'off_size', 'size_verdict', 'has_photo', 'reason',
];
const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

async function main() {
  const all: { image: string; barcode: string }[] = [];
  for (const [image, pieces] of Object.entries(ocr)) {
    for (const barcode of findBarcodes(pieces)) all.push({ image, barcode });
  }
  const key = (r: { image?: string; barcode?: string }) => `${r.image} ${r.barcode}`;

  // In retry mode, keep last time's answers and only re-ask the unreachable ones
  const previous = new Map<string, Row>();
  if (RETRY) {
    if (!existsSync(OUT)) {
      console.log('No earlier results to retry. Run without "retry" first.');
      return;
    }
    for (const r of readCsv(OUT)) previous.set(key(r), r);
  }
  const todo = RETRY ? all.filter((t) => previous.get(key(t))?.result !== 'found' && previous.get(key(t))?.result !== 'notFound') : all;
  console.log(
    RETRY
      ? `Retrying ${todo.length} of ${all.length} barcodes that were unreachable last time…\n`
      : `${all.length} barcodes on ${new Set(all.map((t) => t.image)).size} labels. Asking Open Food Facts…\n`,
  );

  const fresh = new Map<string, Row>();
  for (const [i, { image, barcode }] of todo.entries()) {
    const gt = truth.get(image) ?? {};
    const labelName = [gt.brand, gt.item_name].filter(Boolean).join(' ').trim();
    const result = await fetchProduct(barcode);

    const row: Row = {
      image, store: gt.store ?? '', barcode, kind: barcodeKind(barcode), result: result.kind, database: '',
      label_name: labelName, off_name: '', name_score: '', name_verdict: '',
      label_size: gt.weight_volume ?? '', off_size: '', size_verdict: '', has_photo: '',
      reason: result.kind === 'unavailable' ? result.reason : '',
    };
    if (result.kind === 'found') {
      const p = result.product;
      const offText = nameForCard(p);
      const score = nameScore(labelName, offText);
      row.database = p.source;
      row.off_name = offText;
      row.name_score = String(score);
      row.name_verdict = labelName ? nameVerdict(score) : '';
      row.off_size = p.quantity ?? '';
      row.size_verdict = sizeVerdict(row.label_size, row.off_size, labelName);
      row.has_photo = p.image_url ? 'yes' : 'no';
    }
    fresh.set(key(row), row);

    const mark =
      result.kind === 'found' ? `✔ ${row.name_verdict.padEnd(9)} ${row.off_name}`
      : result.kind === 'unavailable' ? `· unavailable: ${result.reason}`
      : '· notFound';
    console.log(`${String(i + 1).padStart(3)}/${todo.length} ${image.padEnd(18)} ${barcode.padEnd(13)} ${mark}`);
    if (i < todo.length - 1) await sleep(PAUSE_MS);
  }

  // Same order as the labels, with retried answers replacing the old ones
  const rows: Row[] = all.map((t) => fresh.get(key(t)) ?? previous.get(key(t))!).filter(Boolean);
  writeFileSync(OUT, [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c] ?? '')).join(','))].join('\n') + '\n', 'utf-8');

  // ─── Summary ───
  const count = (f: (r: Row) => boolean, of: Row[] = rows) => of.filter(f).length;
  const pct = (n: number, d: number) => (d === 0 ? '–' : `${Math.round((n / d) * 100)}%`);
  const found = rows.filter((r) => r.result === 'found');

  console.log('\n── Summary ──');
  console.log(`Found:        ${found.length} of ${rows.length} (${pct(found.length, rows.length)})`);
  console.log(`Not found:    ${count((r) => r.result === 'notFound')}`);
  const unreachable = rows.filter((r) => r.result === 'unavailable');
  console.log(`Unreachable:  ${unreachable.length}${unreachable.length ? '  ← run with "retry" for these' : ''}`);
  const reasons = new Map<string, number>();
  for (const r of unreachable) reasons.set(r.reason || 'unknown', (reasons.get(r.reason || 'unknown') ?? 0) + 1);
  for (const [reason, n] of reasons) console.log(`  ${n} × ${reason}`);
  console.log(`\nOf the ${found.length} found:`);
  console.log(`  name matches the label:  ${count((r) => r.name_verdict === 'match', found)}`);
  console.log(`  name partly matches:     ${count((r) => r.name_verdict === 'partial', found)}`);
  console.log(`  name looks different:   ${count((r) => r.name_verdict === 'different', found)}  ← check these by eye`);
  console.log(`  size the same:           ${count((r) => r.size_verdict === 'same', found)}, different: ${count((r) => r.size_verdict === 'different', found)}, can't tell: ${count((r) => r.size_verdict === 'unknown', found)}`);
  console.log(`  has a photo:             ${count((r) => r.has_photo === 'yes', found)}`);

  console.log('\nBy store                 found   name matches');
  for (const store of [...new Set(rows.map((r) => r.store))].sort()) {
    const s = rows.filter((r) => r.store === store);
    const f = s.filter((r) => r.result === 'found');
    console.log(`  ${store.padEnd(22)} ${`${f.length}/${s.length}`.padEnd(7)} ${count((r) => r.name_verdict === 'match', f)}/${f.length}`);
  }

  const store = rows.filter((r) => r.kind === 'storeCode');
  console.log(`\nIn-store codes: ${count((r) => r.result === 'found', store)} of ${store.length} found (product barcodes: ${count((r) => r.result === 'found' && r.kind === 'product')} of ${rows.length - store.length})`);
  console.log(`\nFull list saved to parser-data/off_shelf_barcodes.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
