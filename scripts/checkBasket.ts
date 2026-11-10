// Checks the basket rules in lib/basket.ts.
// Run from the project folder:   npx tsx scripts/checkBasket.ts

import { addLine, newLineId, readSavedBasket, removeLine, setQuantity, summarise, updateLine } from '../lib/basket';
import type { BasketItem } from '../types';

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

const item = (id: string, over: Partial<BasketItem> = {}): BasketItem => ({
  id, product_name: '', store_name: 'Tesco', price: 1.2, club_card_price: null,
  club_card_name: 'Tesco Clubcard', deal: null, quantity: 1, source: 'manual', ...over,
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
expect('line ids are unique', new Set(Array.from({ length: 1000 }, newLineId)).size, 1000);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures) process.exitCode = 1;
