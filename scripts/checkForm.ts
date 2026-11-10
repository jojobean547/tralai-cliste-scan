// Checks the confirm card's rules in lib/confirmForm.ts and lib/barcode.ts.
// Run from the project folder:   npx tsx scripts/checkForm.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clubCardFor } from '../constants/stores';
import { isValidBarcode } from '../lib/barcode';
import { checkForm, chooseDeal, emptyForm, formFromDraft, formToBasketItem, parseEuro, type ConfirmForm } from '../lib/confirmForm';
import { parseLabel, type OcrPiece } from '../lib/labelParser/parseLabel';
import { toConfirmDraft } from '../lib/labelParser/toConfirmDraft';

let failures = 0;
function expect(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${what}${ok ? '' : `\n     got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}
const form = (over: Partial<ConfirmForm>): ConfirmForm => ({ ...emptyForm(), ...over });
const tesco = clubCardFor('Tesco');
const dunnes = clubCardFor('Dunnes Stores');

console.log('Typing prices\n');
for (const [typed, value] of [['1.29', 1.29], ['1,29', 1.29], ['€1.29', 1.29], ['€ 4', 4], ['.99', 0.99], ['99c', 0.99], ['1.', 1], ['abc', null], ['1.299', null], ['', null]] as const) {
  expect(`"${typed}" reads as ${value}`, parseEuro(typed), value);
}

console.log('\nBarcodes\n');
expect('real EAN-13 from Centra_002 accepted', isValidBarcode('5000159460880'), true);
expect('one digit wrong is caught', isValidBarcode('5000159460881'), false);
expect('EAN-8 accepted', isValidBarcode('96385074'), true);
expect('letters rejected', isValidBarcode('50001594608a0'), false);

console.log('\nChecking the card\n');
expect('empty card: asks for the price', checkForm(emptyForm(), tesco).errors, { price: 'Enter the shelf price, for example 1.29' });
expect('just a price is enough', checkForm(form({ priceText: '1.20' }), tesco).ok, true);
expect('club price must be lower', checkForm(form({ priceText: '1.20', clubPriceText: '1.50' }), tesco).errors.clubPrice,
  'The Tesco Clubcard price should be lower than the shelf price');
expect('club price ignored where labels have none (Dunnes)', checkForm(form({ priceText: '1.20', clubPriceText: '9' }), dunnes).ok, true);
expect('"3 for 2" button fills in 3 and 2', [chooseDeal(emptyForm(), 'qty').dealQtyText, chooseDeal(emptyForm(), 'qty').dealPayText], ['3', '2']);
expect('price deal needs its price', checkForm(form({ priceText: '1.50', dealChoice: 'price', dealQtyText: '3' }), dunnes).errors.dealPrice,
  'Enter the deal price, for example 4.00');
expect('a "deal" dearer than buying separately is queried', checkForm(form({ priceText: '1.00', dealChoice: 'price', dealQtyText: '3', dealPriceText: '4' }), dunnes).errors.dealPrice,
  '3 for €4.00 costs more than buying them separately. Please check.');
expect('3 for 3 is not a deal', Boolean(checkForm(form({ priceText: '1', dealChoice: 'qty', dealQtyText: '3', dealPayText: '3' }), dunnes).errors.dealPay), true);
expect('a mistyped barcode is caught', Boolean(checkForm(form({ priceText: '1', barcodeText: '5000159460881' }), dunnes).errors.barcode), true);

console.log('\nCard to basket line\n');
const filled = form({ priceText: '3,50', clubPriceText: '3', dealChoice: 'price', dealQtyText: '2', dealPriceText: '5', clubOnly: true,
  quantity: 2, name: ' Ham ', category: 'meat_fish', barcodeText: '5000159460880' });
expect('Tesco line built from the card', formToBasketItem(filled, 'Tesco', tesco, 'id1', 'manual'), {
  id: 'id1', product_name: 'Ham', store_name: 'Tesco', price: 3.5, club_card_price: 3, club_card_name: 'Tesco Clubcard',
  deal: { deal_type: 'price', deal_qty: 2, deal_price: 5, deal_pay_qty: null, club_only: true },
  quantity: 2, source: 'manual', barcode: '5000159460880', image_url: null, category: 'meat_fish',
});
const atDunnes = formToBasketItem(filled, 'Dunnes Stores', dunnes, 'id2', 'manual');
expect('at Dunnes: no club price, deal not club-only', [atDunnes?.club_card_price, atDunnes?.deal?.club_only], [null, false]);
expect('an unfinished card gives no line', formToBasketItem(emptyForm(), 'Tesco', tesco, 'id3', 'manual'), null);

console.log('\nScanned labels fill the card\n');
const ocr: Record<string, OcrPiece[]> = JSON.parse(readFileSync(join(process.cwd(), 'parser-data', 'p2b_ocr_raw.json'), 'utf-8'));
const fromLabel = (image: string, store: string) => formFromDraft(toConfirmDraft(parseLabel(ocr[`${image}.jpg`], store), store));
const t005 = fromLabel('Tesco_005', 'Tesco');
expect('Tesco_005: 3.50, 2 for €5.00, Clubcard only', [t005.priceText, t005.dealChoice, t005.dealQtyText, t005.dealPriceText, t005.clubOnly], ['3.50', 'price', '2', '5.00', true]);
const d042 = fromLabel('Dunnes_042', 'Dunnes Stores');
expect('Dunnes_042: 3 for 2', [d042.dealChoice, d042.dealQtyText, d042.dealPayText], ['qty', '3', '2']);
const l032 = fromLabel('Lidl_032', 'Lidl');
expect('Lidl_032: "3 for" pre-filled, price left for the shopper', [l032.dealChoice, l032.dealQtyText, l032.dealPriceText], ['price', '3', '']);
expect('Lidl_032: the card asks for the missing deal price', checkForm(l032, clubCardFor('Lidl')).errors.dealPrice, 'Enter the deal price, for example 4.00');

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures) process.exitCode = 1;
