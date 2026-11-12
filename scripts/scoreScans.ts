// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Scores scans exported from the phone (Settings → Export scans). The right answer
// is what the shopper added after checking each label.
//
// It scores two ways:
//   at the time  – what the parser filled in on the phone when the label was scanned
//   now          – the parser as it is in this folder today, re-run on the same reading
// So after changing the parser, run this again to see if it helped, without going
// back to the shop.
//
// Run from the project folder, with the exported folder copied onto the computer:
//   npx tsx scripts/scoreScans.ts "C:\Users\you\Downloads\tralai-scans-20261112-1830"
// Add --misses to list every label the parser got wrong now, with its photo name.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLabel, PARSER_VERSION } from '../lib/labelParser/parseLabel';
import { toConfirmDraft } from '../lib/labelParser/toConfirmDraft';
import {
  dealValue, passesPriceMark, PRICE_PASS_MARK, readRecord, scoreScan, summarise, tallyText,
  type ScanRecord, type Summary, type Values,
} from '../lib/scanLog';

const folder = process.argv.slice(2).find((a) => !a.startsWith('--'));
const showMisses = process.argv.includes('--misses');

if (!folder || !existsSync(join(folder, 'scans.json'))) {
  console.log('Give the exported folder, the one with scans.json in it:');
  console.log('  npx tsx scripts/scoreScans.ts "C:\\Users\\you\\Downloads\\tralai-scans-20261112-1830"');
  process.exit(1);
}

const raw: unknown = JSON.parse(readFileSync(join(folder, 'scans.json'), 'utf-8'));
const records: ScanRecord[] = (Array.isArray(raw) ? raw : [])
  .map((r) => readRecord(JSON.stringify(r)))
  .filter((r): r is ScanRecord => r !== null);

if (records.length === 0) {
  console.log('No readable scans in that scans.json.');
  process.exit(1);
}

// The parser as it is today, on the reading saved from the phone
function readNow(r: ScanRecord): Values {
  const draft = toConfirmDraft(parseLabel(r.ocr, r.store), r.store);
  return { price: draft.price, club_card_price: draft.club_card_price, deal: dealValue(draft.deal) };
}

const then = summarise(records);
const nowRows = records.map((r) => ({ ...r, read: readNow(r) }));
const now = summarise(nowRows);

const versions = [...new Set(records.map((r) => r.parser_version))].join(', ');
console.log(`${records.length} scans · parser at the time: ${versions} · parser now: ${PARSER_VERSION}\n`);

const row = (label: string, a: Summary['price'], b: Summary['price']) =>
  console.log(`  ${label.padEnd(12)} ${tallyText(a).padEnd(18)} ${tallyText(b)}`);

console.log('               at the time        now');
row('Shelf price', then.price, now.price);
row('Club price', then.club, now.club);
row('Deal', then.deal, now.deal);

const pass = passesPriceMark(now.price);
console.log(`\n  Pass mark (${Math.round(PRICE_PASS_MARK * 10)} in 10 shelf prices right): ${pass ? 'PASSED' : 'not yet'}\n`);

console.log('By store (shelf price, now)');
for (const [store, s] of Object.entries(now.byStore).sort(([a], [b]) => a.localeCompare(b))) {
  const mark = passesPriceMark(s.price) ? '✓' : '✗';
  console.log(`  ${mark} ${store.padEnd(12)} ${tallyText(s.price).padEnd(18)} club ${tallyText(s.club).padEnd(16)} deal ${tallyText(s.deal)}`);
}

// What changed between then and now, label by label
const fixed = records.filter((r, i) => !scoreScan(r.read, r.confirmed).price && scoreScan(nowRows[i].read, r.confirmed).price);
const broken = records.filter((r, i) => scoreScan(r.read, r.confirmed).price && !scoreScan(nowRows[i].read, r.confirmed).price);
if (fixed.length || broken.length) {
  console.log(`\nShelf price since the scans were taken: ${fixed.length} fixed, ${broken.length} now wrong`);
  for (const r of broken) console.log(`  now wrong: ${r.photo ?? r.id}`);
}

// Every miss, for looking at the photo next to what was read
const money = (n: number | null) => (n === null ? '–' : `€${n.toFixed(2)}`);
const misses = nowRows.filter((r) => {
  const s = scoreScan(r.read, r.confirmed);
  return !s.price || s.club === false || s.deal === false;
});
const lines = ['photo,store,field,read,right,product'];
for (const r of misses) {
  const s = scoreScan(r.read, r.confirmed);
  const name = `"${r.product_name.replace(/"/g, '""')}"`;
  if (!s.price) lines.push(`${r.photo ?? r.id},${r.store},price,${money(r.read.price)},${money(r.confirmed.price)},${name}`);
  if (s.club === false) lines.push(`${r.photo ?? r.id},${r.store},club,${money(r.read.club_card_price)},${money(r.confirmed.club_card_price)},${name}`);
  if (s.deal === false) lines.push(`${r.photo ?? r.id},${r.store},deal,"${JSON.stringify(r.read.deal).replace(/"/g, "'")}","${JSON.stringify(r.confirmed.deal).replace(/"/g, "'")}",${name}`);
}
writeFileSync(join(folder, 'misses.csv'), lines.join('\n') + '\n', 'utf-8');
console.log(`\n${misses.length} labels with something wrong now. Listed in misses.csv in the same folder.`);

if (showMisses) {
  console.log('');
  for (const r of misses) {
    const s = scoreScan(r.read, r.confirmed);
    const what = [
      !s.price ? `price ${money(r.read.price)} → ${money(r.confirmed.price)}` : '',
      s.club === false ? `club ${money(r.read.club_card_price)} → ${money(r.confirmed.club_card_price)}` : '',
      s.deal === false ? 'deal' : '',
    ].filter(Boolean).join(', ');
    console.log(`  ${(r.photo ?? r.id).padEnd(34)} ${r.store.padEnd(10)} ${what}`);
  }
}
