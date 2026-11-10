// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Checks the Open Food Facts logic with saved sample replies (no internet needed):
//   npx tsx scripts/checkOff.ts

import type { ConfirmForm } from '../lib/confirmForm';
import {
  addToCache, isFresh, parseProductReply, productUrl, readCache, tidyName,
  type LookupProduct, type ProductCache,
} from '../lib/openFoodFacts';
import { applyProduct, lookupMessage, lookupTone, nameForCard, type LookupStatus } from '../lib/productLookup';

let passed = 0;
let failed = 0;
function check(what: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else {
    failed++;
    console.log(`FAIL ${what}\n  expected ${e}\n  got      ${a}`);
  }
}

const NOW = new Date('2026-11-10T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

// A form like emptyForm() makes (kept here so this script needs no app code)
const blankForm = (): ConfirmForm => ({
  priceText: '', clubPriceText: '', dealChoice: 'none',
  dealQtyText: '', dealPriceText: '', dealPayText: '', clubOnly: false,
  quantity: 1, name: '', category: null, barcodeText: '', imageUrl: null,
});

// ─── The web address ───
const url = productUrl('world.openfoodfacts.org', '5000157024671');
check('uses API v2', url.startsWith('https://world.openfoodfacts.org/api/v2/product/5000157024671.json'), true);
check('asks only for some fields', url.includes('?fields=code,product_name,'), true);

// ─── Reading replies ───
const beans = {
  code: '5000157024671',
  status: 1,
  status_verbose: 'product found',
  product: {
    product_name: 'Baked Beans in Tomato Sauce',
    brands: 'Heinz,Kraft Heinz',
    quantity: '415 g',
    image_front_small_url: 'https://images.openfoodfacts.org/images/products/500/015/702/4671/front_en.3.200.jpg',
  },
};
const p = parseProductReply(beans, '5000157024671', 'openfoodfacts', NOW);
check('found: name', p?.product_name, 'Baked Beans in Tomato Sauce');
check('found: first brand only', p?.brand, 'Heinz');
check('found: quantity', p?.quantity, '415 g');
check('found: small photo', p?.image_url?.endsWith('front_en.3.200.jpg'), true);
check('found: source', p?.source, 'openfoodfacts');
check('found: date stamped', p?.fetched_at, NOW.toISOString());

check('English name preferred', parseProductReply(
  { status: 1, product: { product_name: 'Haricots', product_name_en: 'Beans', image_url: 'https://x/y.jpg' } }, '1', 'openfoodfacts', NOW,
)?.product_name, 'Beans');
check('generic name as fallback', parseProductReply(
  { status: 1, product: { product_name: '  ', generic_name: 'Porridge oats' } }, '1', 'openfoodfacts', NOW,
)?.product_name, 'Porridge oats');
check('photo falls back to front photo', parseProductReply(
  { status: 1, product: { product_name: 'X', image_front_url: 'https://a/front.jpg', image_url: 'https://a/other.jpg' } }, '1', 'openfoodfacts', NOW,
)?.image_url, 'https://a/front.jpg');
check('http photo upgraded to https', parseProductReply(
  { status: 1, product: { product_name: 'X', image_url: 'http://a/b.jpg' } }, '1', 'openfoodfacts', NOW,
)?.image_url, 'https://a/b.jpg');
check('odd photo address ignored', parseProductReply(
  { status: 1, product: { product_name: 'X', image_url: 'file:///x.jpg' } }, '1', 'openfoodfacts', NOW,
)?.image_url, null);
check('photo but no name still counts', parseProductReply(
  { status: 1, product: { image_url: 'https://a/b.jpg' } }, '1', 'openfoodfacts', NOW,
)?.product_name, '');

check('status 0 is not found', parseProductReply({ status: 0, status_verbose: 'product not found' }, '1', 'openfoodfacts', NOW), null);
check('no name and no photo is not found', parseProductReply({ status: 1, product: { brands: 'Tesco' } }, '1', 'openfoodfacts', NOW), null);
check('null reply', parseProductReply(null, '1', 'openfoodfacts', NOW), null);
check('text reply', parseProductReply('<html>busy</html>', '1', 'openfoodfacts', NOW), null);
check('product missing', parseProductReply({ status: 1 }, '1', 'openfoodfacts', NOW), null);

// ─── Tidying names ───
check('all capitals', tidyName('TAYTO CHEESE & ONION'), 'Tayto Cheese & Onion');
check('all lower case', tidyName('brennans  white bread'), 'Brennans White Bread');
check('mixed case left alone', tidyName("McVitie's Digestives"), "McVitie's Digestives");
check('sizes survive', tidyName('KERRYGOLD BUTTER 227G'), 'Kerrygold Butter 227g');
check('not text', tidyName(42), '');

// ─── Name for the card ───
const make = (over: Partial<LookupProduct>): LookupProduct => ({
  barcode: '1', product_name: '', brand: null, quantity: null, image_url: null,
  source: 'openfoodfacts', fetched_at: NOW.toISOString(), ...over,
});
check('brand + name + size', nameForCard(p!), 'Heinz Baked Beans in Tomato Sauce 415 g');
check('brand already in name', nameForCard(make({ product_name: 'Heinz Beanz', brand: 'Heinz', quantity: '415 g' })), 'Heinz Beanz 415 g');
check('size already in name', nameForCard(make({ product_name: 'Beans 415g', quantity: '415 g' })), 'Beans 415g');
check('no name: brand + size', nameForCard(make({ brand: 'Avonmore', quantity: '2 L' })), 'Avonmore 2 L');
// From the shelf-label test (10 Nov 2026)
check("brand with apostrophe not repeated", nameForCard(make({ product_name: 'Hellmanns Thousand Island Dressing', brand: "Hellmann's", quantity: '250ml' })), 'Hellmanns Thousand Island Dressing 250ml');
check('brand first word already there', nameForCard(make({ product_name: 'Lyons Original Blend Tea', brand: 'Lyons Tea' })), 'Lyons Original Blend Tea');
check('brand overlapping the name', nameForCard(make({ product_name: 'Organic black beans', brand: 'Biona Organic', quantity: '400 g' })), 'Biona Organic black beans 400 g');
check('size without a unit left out', nameForCard(make({ product_name: 'Smarties', brand: 'Nestlé', quantity: '1' })), 'Nestlé Smarties');
check('multipack size kept', nameForCard(make({ product_name: 'Curlywurly', brand: 'Cadbury', quantity: '4 × 21.5g' })), 'Cadbury Curlywurly 4 × 21.5g');
check('accented brand already there', nameForCard(make({ product_name: 'Nescafe Gold Blend', brand: 'Nescafé' })), 'Nescafe Gold Blend');
check('brand inside a longer word still added', nameForCard(make({ product_name: 'Chocolate Biscuits', brand: 'Choco Bistro', quantity: '200 g' })), 'Choco Bistro Chocolate Biscuits 200 g');
check('two-word brand, nothing shared', nameForCard(make({ product_name: 'Simply Better Pistachio Spread', brand: 'Dunnes Stores' })), 'Dunnes Stores Simply Better Pistachio Spread');

// ─── Filling the card ───
const filled = applyProduct({ ...blankForm(), barcodeText: '5000 1570 24671', priceText: '1.29' }, p!);
check('empty name filled in', filled.name, 'Heinz Baked Beans in Tomato Sauce 415 g');
check('photo filled in', filled.imageUrl, p!.image_url);
check('barcode cleaned up', filled.barcodeText, '5000157024671');
check('price left alone', filled.priceText, '1.29');
check('typed name kept', applyProduct({ ...blankForm(), name: 'Beans' }, p!).name, 'Beans');
check('no photo keeps the old one', applyProduct({ ...blankForm(), imageUrl: 'https://old.jpg' }, make({ product_name: 'X' })).imageUrl, 'https://old.jpg');

// ─── Messages ───
const statuses: LookupStatus[] = ['idle', 'loading', 'found', 'suggested', 'notFound', 'unavailable', 'invalid'];
check('messages only after a look-up', statuses.map((s) => lookupMessage(s) !== null), [false, false, true, true, true, true, true]);
check('box colours', statuses.map(lookupTone), [null, null, 'good', 'note', 'note', 'problem', 'note']);

// ─── The on-phone cache ───
check('10 days old is fresh', isFresh(make({ fetched_at: daysAgo(10) }), NOW), true);
check('40 days old is stale', isFresh(make({ fetched_at: daysAgo(40) }), NOW), false);
check('bad date is stale', isFresh(make({ fetched_at: 'yesterday' }), NOW), false);

let cache: ProductCache = {};
cache = addToCache(cache, make({ barcode: 'a', fetched_at: daysAgo(3) }), 2);
cache = addToCache(cache, make({ barcode: 'b', fetched_at: daysAgo(1) }), 2);
cache = addToCache(cache, make({ barcode: 'c', fetched_at: daysAgo(2) }), 2);
check('full cache drops the oldest', Object.keys(cache).sort(), ['b', 'c']);
cache = addToCache(cache, make({ barcode: 'b', product_name: 'New', fetched_at: daysAgo(0) }), 2);
check('same barcode replaced', [Object.keys(cache).length, cache.b.product_name], [2, 'New']);

check('nothing saved yet', readCache(null), {});
check('damaged save', readCache('{not json'), {});
check('list instead of object', readCache('[1,2]'), {});
const saved = JSON.stringify({ x: make({ barcode: 'x' }), y: { barcode: 'y' }, z: make({ barcode: 'other' }) });
check('only good entries kept', Object.keys(readCache(saved)), ['x']);

console.log(`\ncheckOff: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
