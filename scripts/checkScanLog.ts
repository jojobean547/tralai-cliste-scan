// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Checks the saved-scan rules (lib/scanLog.ts). No phone or internet needed.
//   npx tsx scripts/checkScanLog.ts

import { dealValue, newScanId, passesPriceMark, readRecord, scoreScan, summarise, tallyText, type Values } from '../lib/scanLog';

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

const v = (price: number | null, club: number | null = null, deal: Values['deal'] = null): Values => ({ price, club_card_price: club, deal });
const threeFor4 = { type: 'price' as const, qty: 3, price: 4, pay: null };

// ─── One scan ───
expect('all right', scoreScan(v(1.29), v(1.29)), { price: true, club: null, deal: null });
expect('price wrong', scoreScan(v(1.92), v(1.29)).price, false);
expect('price not read', scoreScan(v(null), v(1.29)).price, false);
expect('cents rounding still right', scoreScan(v(1.2900000001), v(1.29)).price, true);
expect('club right', scoreScan(v(2, 1.5), v(2, 1.5)).club, true);
expect('club missed', scoreScan(v(2, null), v(2, 1.5)).club, false);
expect('club invented', scoreScan(v(2, 1.5), v(2, null)).club, false);
expect('deal right', scoreScan(v(2, null, threeFor4), v(2, null, threeFor4)).deal, true);
expect('deal half read ("3 for" only)', scoreScan(v(2, null, { type: null, qty: 3, price: null, pay: null }), v(2, null, threeFor4)).deal, false);
expect('deal missed', scoreScan(v(2), v(2, null, threeFor4)).deal, false);
expect('deal from the basket', dealValue({ deal_type: 'qty', deal_qty: 3, deal_price: null, deal_pay_qty: 2, club_only: true }), { type: 'qty', qty: 3, price: null, pay: 2 });

// ─── Many scans ───
const records = [
  { store: 'Tesco', read: v(1.29), confirmed: v(1.29) },
  { store: 'Tesco', read: v(3.5, 3), confirmed: v(3.5, 3) },
  { store: 'Lidl', read: v(null), confirmed: v(0.89) },
  { store: 'Lidl', read: v(2.49, null, threeFor4), confirmed: v(2.49, null, threeFor4) },
  { store: 'Lidl', read: v(1.99), confirmed: v(1.99) },
];
const s = summarise(records);
expect('total', [s.scans, s.price], [5, { right: 4, total: 5 }]);
expect('club and deal only count when there is one', [s.club, s.deal], [{ right: 1, total: 1 }, { right: 1, total: 1 }]);
expect('by store', [s.byStore.Tesco.price, s.byStore.Lidl.price], [{ right: 2, total: 2 }, { right: 2, total: 3 }]);
expect('text', [tallyText(s.price), tallyText({ right: 0, total: 0 })], ['4 of 5 (80%)', 'none yet']);
expect('pass mark: 8 in 10 passes', [passesPriceMark({ right: 8, total: 10 }), passesPriceMark({ right: 7, total: 10 }), passesPriceMark({ right: 0, total: 0 })], [true, false, null]);

// ─── Saving and reading back ───
const id = newScanId(new Date('2026-11-12T09:30:15Z'), 0.5);
expect('id is a safe file name', /^scan-20261112-093015-[0-9a-z]{4,}$/.test(id), true);
const good = JSON.stringify({ id, store: 'Tesco', ocr: [], read: v(1), confirmed: v(1) });
expect('reads a saved record', readRecord(good)?.id, id);
expect('damaged file skipped', readRecord('{"id": 1'), null);
expect('missing fields skipped', readRecord('{"id":"x","store":"Tesco"}'), null);

console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) failed`);
if (failures > 0) process.exit(1);
