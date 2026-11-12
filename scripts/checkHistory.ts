// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Checks the shopping history rules (lib/history.ts). No phone needed.
//   npx tsx scripts/checkHistory.ts

import {
  addShops, dayLabel, describeShopLine, finishSummary, groupByDay, readSavedHistory, removeShop,
  shopsFromBasket, timeLabel, type Shop,
} from '../lib/history';
import type { BasketItem } from '../types';

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

const item = (id: string, store: string, over: Partial<BasketItem> = {}): BasketItem => ({
  id, product_name: '', store_name: store, price: 1, club_card_price: null, club_card_name: null,
  deal: null, quantity: 1, source: 'scan', barcode: null, image_url: null, category: null, ...over,
});
let n = 0;
const makeId = () => `shop-${++n}`;
const noCard = () => false;
const hasCard = () => true;

// Times in the phone's own time zone: 11 Nov 2026
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);
const NOW = at(11, 21);

// ─── Finishing a shop ───
const basket = [
  item('a', 'Lidl', { price: 2.49, quantity: 2, product_name: 'Milk' }),
  item('b', 'Dunnes Stores', { price: 3.5 }),
  item('c', 'Lidl', { price: 1.2, quantity: 3, deal: { deal_type: 'qty', deal_qty: 3, deal_pay_qty: 2, deal_price: null, club_only: false } }),
  item('d', 'Tesco', { price: 4, club_card_price: 3, club_card_name: 'Tesco Clubcard' }),
];
const shops = shopsFromBasket(basket, noCard, at(11, 18), makeId);
expect('one shop per store, in the order visited', shops.map((s) => s.store), ['Lidl', 'Dunnes Stores', 'Tesco']);
expect('Lidl total: 2 × €2.49 + 3 for 2 at €1.20 = €7.38', shops[0].total, 7.38);
expect('Lidl items and saving', [shops[0].item_count, shops[0].saving], [5, 1.2]);
expect('line totals kept', shops[0].lines.map((l) => l.total), [4.98, 2.4]);
expect('Tesco without the card: shelf price', shops[2].total, 4);
expect('Tesco with the card: club price', shopsFromBasket(basket, hasCard, at(11, 18), makeId)[2].total, 3);
expect('empty basket: no shops', shopsFromBasket([], noCard, NOW, makeId), []);
expect('summary, one store', finishSummary([{ store: 'Lidl', total: 23.4 }]), 'Lidl €23.40');
expect('summary, three stores', finishSummary([{ store: 'Lidl', total: 23.4 }, { store: 'Dunnes Stores', total: 15.1 }, { store: 'Aldi', total: 31 }]), 'Lidl €23.40, Dunnes Stores €15.10 and Aldi €31.00');

// ─── The history ───
const shop = (id: string, store: string, when: Date, total: number): Shop =>
  ({ id, store, finished_at: when.toISOString(), lines: [], total, item_count: 1, saving: 0 });
let history: Shop[] = [];
history = addShops(history, [shop('l', 'Lidl', at(11, 10), 23.4)]);
history = addShops(history, [shop('d', 'Dunnes Stores', at(11, 12), 15.1), shop('a', 'Aldi', at(11, 12, 1), 31)]);
history = addShops(history, [shop('y', 'Tesco', at(10, 19), 40)]);
history = addShops(history, [shop('o', 'SuperValu', at(2, 9), 12.5)]);
expect('newest first', history.map((s) => s.id), ['a', 'd', 'l', 'y', 'o']);
const days = groupByDay(history, NOW);
expect('grouped by day', days.map((d) => [d.label, d.shops.length, d.total]), [['Today', 3, 69.5], ['Yesterday', 1, 40], ['Mon 2 Nov', 1, 12.5]]);
expect('kept to the newest', addShops(history, [shop('z', 'Lidl', at(11, 20), 1)], 3).map((s) => s.id), ['z', 'a', 'd']);
expect('deleting a shop', removeShop(history, 'd').map((s) => s.id), ['a', 'l', 'y', 'o']);

// ─── Labels ───
expect('another year', dayLabel(new Date(2025, 11, 12), NOW), 'Fri 12 Dec 2025');
expect('just after midnight is still yesterday', dayLabel(at(10, 23, 59), at(11, 0, 1)), 'Yesterday');
expect('time', timeLabel(at(11, 8, 5)), '08:05');
expect('item line with quantity and deal', describeShopLine(shops[0].lines[1], 2), { title: '3 × Item 2', deal: '3 for 2', total: '€2.40' });
expect('named item', describeShopLine(shops[0].lines[0], 1).title, '2 × Milk');

// ─── Saved on the phone ───
expect('reads saved history', readSavedHistory(JSON.stringify(history)).length, 5);
expect('damaged save', readSavedHistory('{oops'), []);
expect('bad entries skipped', readSavedHistory(JSON.stringify([shop('ok', 'Lidl', NOW, 1), { id: 'x' }, { ...shop('bad', 'Lidl', NOW, 1), finished_at: 'soon' }])).map((s) => s.id), ['ok']);

console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) failed`);
if (failures > 0) process.exit(1);
