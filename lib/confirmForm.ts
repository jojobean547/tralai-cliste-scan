// The confirm card's rules: what the shopper has typed, whether it makes sense,
// and turning it into a basket line. Plain functions, tested on the computer:
//   npx tsx scripts/checkForm.ts
// hooks/useScanScreen.ts holds the form while it's on screen.

import type { ClubCardInfo } from '../constants/stores';
import type { CategoryId } from '../constants/categories';
import type { BasketItem, DealInput } from '../types';
import { isValidBarcode } from './barcode';
import type { ConfirmDraft } from './labelParser/toConfirmDraft';

export type DealChoice = 'none' | 'price' | 'qty';

// Numbers are kept as the text typed, so "1." or "1,2" mid-typing isn't lost
export type ConfirmForm = {
  priceText: string;
  clubPriceText: string;
  dealChoice: DealChoice;
  dealQtyText: string;   // the 3 in "3 for €4" or "3 for 2"
  dealPriceText: string; // the €4 in "3 for €4"
  dealPayText: string;   // the 2 in "3 for 2"
  clubOnly: boolean;
  quantity: number;
  name: string;
  category: CategoryId | null;
  barcodeText: string;
  imageUrl: string | null;
};

export type FormField = 'price' | 'clubPrice' | 'dealQty' | 'dealPrice' | 'dealPay' | 'barcode';
export type FormErrors = Partial<Record<FormField, string>>;

export function emptyForm(): ConfirmForm {
  return {
    priceText: '', clubPriceText: '', dealChoice: 'none',
    dealQtyText: '', dealPriceText: '', dealPayText: '', clubOnly: false,
    quantity: 1, name: '', category: null, barcodeText: '', imageUrl: null,
  };
}

// Picking a deal type on the card. "3 for 2" is the only form Irish shelves use,
// so it's filled in ready; "3 for €4" varies, so it's left for the shopper.
export function chooseDeal(form: ConfirmForm, choice: DealChoice): ConfirmForm {
  if (choice === 'qty') return { ...form, dealChoice: 'qty', dealQtyText: form.dealQtyText || '3', dealPayText: form.dealPayText || '2' };
  return { ...form, dealChoice: choice };
}

// Accepts "1.29", "1,29", "€1.29", "€ 1.29", ".99", "99c", "4"
export function parseEuro(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/€|\s/g, '').replace(',', '.');
  if (t === '') return null;
  const cents = /^(\d{1,2})c$/.exec(t);
  if (cents) return Number(cents[1]) / 100;
  if (!/^(\d{1,4}(\.\d{0,2})?|\.\d{1,2})$/.test(t)) return null;
  return Math.round(Number(t) * 100) / 100;
}

function parseWhole(text: string): number | null {
  return /^\s*\d{1,2}\s*$/.test(text) ? Number(text) : null;
}

const money = (n: number | null) => (n === null ? '' : n.toFixed(2));

// Fill the card from what the scanner read
export function formFromDraft(draft: ConfirmDraft): ConfirmForm {
  const form = emptyForm();
  form.priceText = money(draft.price);
  form.clubPriceText = money(draft.club_card_price);
  form.name = draft.product_name;
  form.category = draft.category;
  form.barcodeText = draft.barcode ?? '';
  form.imageUrl = draft.image_url;
  const d = draft.deal;
  if (d) {
    form.clubOnly = d.club_only;
    form.dealQtyText = d.deal_qty === null ? '' : String(d.deal_qty);
    if (d.deal_type === 'qty') {
      form.dealChoice = 'qty';
      form.dealPayText = d.deal_pay_qty === null ? '' : String(d.deal_pay_qty);
    } else {
      // A price deal, or a half-read "3 for": the shopper fills in the price
      // (or taps "3 for 2" if that's what the label says)
      form.dealChoice = 'price';
      form.dealPriceText = money(d.deal_price);
    }
  }
  return form;
}

export function checkForm(form: ConfirmForm, clubCard: ClubCardInfo | null): { errors: FormErrors; ok: boolean } {
  const errors: FormErrors = {};

  const price = parseEuro(form.priceText);
  if (price === null) errors.price = 'Enter the shelf price, for example 1.29';
  else if (price <= 0) errors.price = 'The price must be more than €0';
  else if (price >= 1000) errors.price = 'That price looks too high. Please check it.';

  if (clubCard?.priceOnLabel && form.clubPriceText.trim() !== '') {
    const club = parseEuro(form.clubPriceText);
    if (club === null || club <= 0) errors.clubPrice = `Enter the ${clubCard.name} price, for example 0.99, or leave it empty`;
    else if (price !== null && club >= price) errors.clubPrice = `The ${clubCard.name} price should be lower than the shelf price`;
  }

  if (form.dealChoice !== 'none') {
    const qty = parseWhole(form.dealQtyText);
    if (qty === null || qty < 2) errors.dealQty = 'How many for the deal? For example 3';
    if (form.dealChoice === 'price') {
      const dealPrice = parseEuro(form.dealPriceText);
      if (dealPrice === null || dealPrice <= 0) errors.dealPrice = 'Enter the deal price, for example 4.00';
      else if (price !== null && qty !== null && qty >= 2 && dealPrice >= qty * price) {
        errors.dealPrice = `${qty} for €${dealPrice.toFixed(2)} costs more than buying them separately. Please check.`;
      }
    } else {
      const pay = parseWhole(form.dealPayText);
      if (pay === null || pay < 1 || (qty !== null && pay >= qty)) errors.dealPay = 'You pay for fewer than you get, for example 3 for 2';
    }
  }

  if (form.barcodeText.trim() !== '' && !isValidBarcode(form.barcodeText)) {
    errors.barcode = "That barcode doesn't look right. Please check the numbers, or leave it empty.";
  }

  return { errors, ok: Object.keys(errors).length === 0 };
}

export function formToBasketItem(
  form: ConfirmForm,
  store: string,
  clubCard: ClubCardInfo | null,
  id: string,
  source: 'scan' | 'manual',
): BasketItem | null {
  if (!checkForm(form, clubCard).ok) return null;
  const clubOnLabel = Boolean(clubCard?.priceOnLabel);

  let deal: DealInput | null = null;
  if (form.dealChoice === 'price') {
    deal = { deal_type: 'price', deal_qty: Number(form.dealQtyText), deal_price: parseEuro(form.dealPriceText), deal_pay_qty: null, club_only: clubOnLabel && form.clubOnly };
  } else if (form.dealChoice === 'qty') {
    deal = { deal_type: 'qty', deal_qty: Number(form.dealQtyText), deal_price: null, deal_pay_qty: Number(form.dealPayText), club_only: clubOnLabel && form.clubOnly };
  }

  return {
    id,
    product_name: form.name.trim(),
    store_name: store,
    price: parseEuro(form.priceText)!,
    club_card_price: clubOnLabel ? parseEuro(form.clubPriceText) : null,
    club_card_name: clubCard?.name ?? null,
    deal,
    quantity: form.quantity,
    source,
    barcode: form.barcodeText.trim() || null,
    image_url: form.imageUrl,
    category: form.category,
  };
}
