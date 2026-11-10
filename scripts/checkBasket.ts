// Checks the basket rules in lib/basket.ts.
// Run from the project folder:   npx tsx scripts/checkBasket.ts

import { addLine, newLineId, readSavedBasket, removeLine, setQuantity, summarise, updateLine } from '../lib/basket';
import { cardsWorthSwitchingOn, describeLine } from '../lib/basketDisplay';
import type { BasketItem } from '../types';

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

const item = (id: string, over: Partial<BasketItem> = {}): BasketItem => ({
  id, product_name: '', store_name: 'Tesco', price: 1.2, club_card_price: null,
  club_card_name: 'Tesco Clubcard', deal: null, quantity: 1, source: 'manual',
  barcode: null, image_url: null, category: null, ...over,
});
const noCard = () => false;
const hasCard = () => true;

let basket: BasketItem[] = [];
basket = addLine(basket, item('a', { quantity: 4, deal: { deal_type: 'qty', deal_qty: 3, deal_pay_qty: 2, deal_price: null, club_only: false } }));
basket = addLine(basket, item('b', { price: 3.5, club_card_price: 3 }));
expect('two lines added', basket.map((i) => i.id), ['a', 'b']);
expect('without Clubcard: €3.60 + €3.50 = €7.10, 5 items, saving €1.20', summarise(basket, noCard), { total: 7.1, itemCount: 5, saving: 1.2 });
expect('with Clubcard: €3.60 + €3.00 = €6.60, saving €1.70', summarise(basket, hasCard), { total: 6.6, itemCount: 5, saving: 1.7 });

basket = setQuantity(basket, 'b', 3);
expect('quantity changed to 3', basket.find((i) => i.id === 'b')?.quantity, 3);
basket = updateLine(basket, 'b', { price: 3.75 });
expect('misread price corrected to €3.75', basket.find((i) => i.id === 'b')?.price, 3.75);
basket = setQuantity(basket, 'b', 0);
expect('quantity 0 removes the line', basket.map((i) => i.id), ['a']);
basket = removeLine(basket, 'a');
expect('removed: basket empty', summarise(basket, noCard), { total: 0, itemCount: 0, saving: 0 });

const saved = JSON.stringify([item('ok'), { id: 'broken', price: 'abc' }, item('zero', { quantity: 0 })]);
expect('a damaged saved basket keeps only the good lines', readSavedBasket(saved).map((i) => i.id), ['ok']);
expect('unreadable storage gives an empty basket', readSavedBasket('not json'), []);
expect('nothing saved yet gives an empty basket', readSavedBasket(null), []);
const oldSave = JSON.stringify([{ id: 'old', product_name: 'Beans', store_name: 'Tesco', price: 1.2, club_card_price: null,
  club_card_name: null, deal: null, quantity: 1, source: 'manual' }]);
expect('a basket saved before barcodes and categories still loads', readSavedBasket(oldSave).map((i) => [i.id, i.barcode, i.category]), [['old', null, null]]);
expect('line ids are unique', new Set(Array.from({ length: 1000 }, newLineId)).size, 1000);

// ---- What the Basket screen shows ----
const tesco = item('t', {
  product_name: '', price: 3.5, club_card_price: 3, quantity: 1,
  deal: { deal_type: 'price', deal_qty: 2, deal_price: 5, deal_pay_qty: null, club_only: true },
});
const without = describeLine(tesco, 2, noCard);
expect('unnamed line is called "Item 2"', without.title, 'Item 2');
expect('club price shown as switched off', without.clubText, '€3.00 with Tesco Clubcard, off in Settings');
expect('club-only deal labelled', without.dealText, '2 for €5.00 · Tesco Clubcard only');
expect('explains why the deal is not counted', without.dealNote, 'Not counted: Tesco Clubcard is off in Settings');
expect('each price without the card', without.eachText, '€3.50 each');
const withCard = describeLine(tesco, 2, hasCard);
expect('with the card: club price used', [withCard.eachText, withCard.clubText], ['€3.00 each', 'Tesco Clubcard price (regular €3.50)']);
expect('with the card, 1 of a 2-for deal: nudge to add 1 more', withCard.dealNote, 'Add 1 more to get the deal');
const beans = describeLine(item('b', { product_name: 'Beans', quantity: 4,
  deal: { deal_type: 'qty', deal_qty: 3, deal_pay_qty: 2, deal_price: null, club_only: false } }), 1, noCard);
expect('3 for 2, four tins: total and saving', [beans.title, beans.dealText, beans.totalText, beans.savingText, beans.dealNote], ['Beans', '3 for 2', '€3.60', 'You save €1.20', null]);
expect('no photo, no category: basket icon', beans.icon, { kind: 'category', name: 'basket-outline' });
expect('category picked: its icon', describeLine(item('c', { category: 'dairy_eggs' }), 1, noCard).icon, { kind: 'category', name: 'cheese' });
expect('product photo wins over category', describeLine(item('p', { category: 'drinks', image_url: 'https://x/y.jpg' }), 1, noCard).icon, { kind: 'image', uri: 'https://x/y.jpg' });
expect('cards worth switching on', cardsWorthSwitchingOn([tesco, item('x')], noCard), ['Tesco Clubcard']);
expect('nothing to suggest when the card is on', cardsWorthSwitchingOn([tesco], hasCard), []);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures) process.exitCode = 1;
