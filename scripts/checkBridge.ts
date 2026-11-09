// Checks the bridge (parser output → confirm card) and the deal calculator
// on real capstone labels and worked examples.
//
// Run from the project folder:   npx tsx scripts/checkBridge.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { basketTotal, lineTotal } from '../lib/dealCalculator';
import { parseLabel, type OcrPiece } from '../lib/labelParser/parseLabel';
import { draftToBasketItem, toConfirmDraft } from '../lib/labelParser/toConfirmDraft';
import type { BasketItem } from '../types';
import { readCsv } from './csv';

const DATA = join(process.cwd(), 'parser-data');
const ocr: Record<string, OcrPiece[]> = JSON.parse(readFileSync(join(DATA, 'p2b_ocr_raw.json'), 'utf-8'));
const truth = readCsv(join(DATA, 'ground_truth.csv'));

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}
const draft = (image: string, store: string) => toConfirmDraft(parseLabel(ocr[`${image}.jpg`], store), store);

// ---- 1. Real labels through parser + bridge (store names as the app spells them) ----
console.log('Real labels\n');
const tesco005 = draft('Tesco_005', 'Tesco');
expect('Tesco_005 "Any 2 for €5" is a 2 for €5 deal', [tesco005.deal?.deal_type, tesco005.deal?.deal_qty, tesco005.deal?.deal_price], ['price', 2, 5]);
expect('Tesco_005 deal is Clubcard only', tesco005.deal?.club_only, true);
expect('Tesco_005 club card name comes from the store', tesco005.club_card_name, 'Tesco Clubcard');

const dunnes042 = draft('Dunnes_042', 'Dunnes Stores');
expect('Dunnes_042 "Cheapest Item Free" is 3 for 2', [dunnes042.deal?.deal_type, dunnes042.deal?.deal_qty, dunnes042.deal?.deal_pay_qty], ['qty', 3, 2]);
expect('Dunnes_042 deal is not club only (no club price on Dunnes labels)', dunnes042.deal?.club_only, false);

expect('Dunnes_018 "ONLY" price is €4', draft('Dunnes_018', 'Dunnes Stores').price, 4);

const lidl026 = draft('Lidl_026', 'Lidl');
expect('Lidl_026 loose plums are flagged as possibly weighed', lidl026.possiblyWeighed, true);
expect('Lidl_026 cannot go into the basket', draftToBasketItem(lidl026, 'x', 'scan'), null);

const lidl032 = draft('Lidl_032', 'Lidl');
expect('Lidl_032 "3 for" pre-fills quantity 3 and asks for the rest', [lidl032.deal?.deal_qty, lidl032.state.deal], [3, 'check']);
expect('Lidl_032 cannot go into the basket until the deal is completed', draftToBasketItem(lidl032, 'x', 'scan'), null);

const tesco001 = draft('Tesco_001', 'Tesco');
expect('Tesco_001 shelf 99c, Clubcard 69c', [tesco001.price, tesco001.club_card_price, tesco001.state.club_card_price], [0.99, 0.69, 'found']);

// ---- 2. Summary over all 207 labels ----
const states = { price: {} as Record<string, number>, club_card_price: {} as Record<string, number>, deal: {} as Record<string, number> };
let ready = 0;
for (const row of truth) {
  const d = toConfirmDraft(parseLabel(ocr[row.image_filename], row.store), row.store);
  for (const f of ['price', 'club_card_price', 'deal'] as const) states[f][d.state[f]] = (states[f][d.state[f]] ?? 0) + 1;
  if (draftToBasketItem(d, 'x', 'scan')) ready++;
}
console.log('\nConfirm card states over all 207 labels');
for (const f of ['price', 'club_card_price', 'deal'] as const) console.log(`  ${f.padEnd(16)} ${JSON.stringify(states[f])}`);
console.log(`  could be added straight away (before the shopper's check): ${ready} of ${truth.length}`);

// ---- 3. Deal calculator worked examples ----
console.log('\nDeal calculator\n');
const item = (over: Partial<BasketItem>): BasketItem => ({
  id: 't', product_name: 'Test', store_name: 'Tesco', price: 1.2, club_card_price: null,
  club_card_name: 'Tesco Clubcard', deal: null, quantity: 1, source: 'manual', ...over,
});
const noCard = () => false;
const hasCard = () => true;
const threeFor2 = { deal_type: 'qty' as const, deal_qty: 3, deal_pay_qty: 2, deal_price: null, club_only: false };

expect('€1.20, 3 for 2, quantity 4 → €3.60', lineTotal(item({ deal: threeFor2, quantity: 4 }), noCard), 3.6);
expect('€1.50, 3 for €4, quantity 4 → €5.50',
  lineTotal(item({ price: 1.5, quantity: 4, deal: { deal_type: 'price', deal_qty: 3, deal_price: 4, deal_pay_qty: null, club_only: false } }), noCard), 5.5);
expect('€1.20, Clubcard €1.00, quantity 2, with the card → €2.00', lineTotal(item({ club_card_price: 1, quantity: 2 }), hasCard), 2);
expect('same, without the card → €2.40', lineTotal(item({ club_card_price: 1, quantity: 2 }), noCard), 2.4);
const clubDeal = { deal_type: 'price' as const, deal_qty: 2, deal_price: 5, deal_pay_qty: null, club_only: true };
expect('€3.50, Clubcard-only 2 for €5, quantity 2, with the card → €5.00', lineTotal(item({ price: 3.5, quantity: 2, deal: clubDeal }), hasCard), 5);
expect('same, without the card → €7.00', lineTotal(item({ price: 3.5, quantity: 2, deal: clubDeal }), noCard), 7);
expect('basket of the two lines above, without the card → €10.60',
  basketTotal([item({ deal: threeFor2, quantity: 4 }), item({ price: 3.5, quantity: 2, deal: clubDeal })], noCard), 10.6);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures) process.exitCode = 1;
