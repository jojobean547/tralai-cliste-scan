// The bridge: turns what the parser read into the confirm card's fields,
// with a plain-language note wherever the shopper should look twice.
// It never changes a value it is unsure about. It flags it instead.

import { clubCardFor } from '../../constants/stores';
import type { CategoryId } from '../../constants/categories';
import type { BasketItem, DealInput } from '../../types';
import { PARSER_VERSION, type ParseResult } from './parseLabel';

// found     read from the label
// check     read, but looks odd: the shopper should check it
// missing   the label has it, but it couldn't be read
// none      not on this label
export type FieldState = 'found' | 'check' | 'missing' | 'none';

export type ConfirmDraft = {
  store: string;
  product_name: string;            // left empty: OCR product names are too noisy to pre-fill
  price: number | null;
  club_card_price: number | null;
  club_card_name: string | null;
  deal: DealInput | null;
  quantity: number;
  state: { price: FieldState; club_card_price: FieldState; deal: FieldState };
  notes: string[];                 // shown on the confirm card
  possiblyWeighed: boolean;
  parser_version: string;
  barcode: string | null;          // filled by barcode reading / lookup in a later step
  image_url: string | null;
  category: CategoryId | null;
};

export function toConfirmDraft(parsed: ParseResult, store: string): ConfirmDraft {
  const club = clubCardFor(store);
  const notes: string[] = [];

  // ---- Shelf price ----
  const price = parsed.standard_price;
  const priceState: FieldState = price === null ? 'missing' : 'found';

  // Only per-kg price, no pack size, no deal: probably loose produce sold by weight
  const possiblyWeighed =
    price === null && parsed.unit === 'kg' && parsed.weight_volume === null && parsed.deal_type === null;
  if (possiblyWeighed) {
    notes.push("No shelf price found. If this is sold loose by weight, weighed items aren't supported yet.");
  } else if (price === null) {
    notes.push("Couldn't read the shelf price. Please type it in.");
  }

  // ---- Club card price: only for stores that print it on the label ----
  let clubPrice: number | null = null;
  let clubState: FieldState = 'none';
  if (club?.priceOnLabel) {
    if (parsed.clubcard_price !== null) {
      clubPrice = parsed.clubcard_price;
      clubState = 'found';
      if (price !== null && clubPrice >= price) {
        clubState = 'check';
        notes.push(`The ${club.name} price isn't lower than the shelf price. Please check.`);
      }
    } else if (parsed.has_clubcard_price && parsed.deal_type === null && parsed.deal_qty_hint === null) {
      // The label names the card but no club price was read. When there is a deal,
      // the deal itself is usually the club benefit (Lidl Plus Mix n Match), so no warning.
      clubState = 'missing';
      notes.push(`The label mentions ${club.name}, but its price couldn't be read.`);
    }
  }

  // ---- Deal ----
  // On labels with a club card panel, deals were club-only in every example so far
  // (Tesco "Any 2 for €5", Lidl Plus Mix n Match, SuperValu Rewards), so they start
  // as club-only and the shopper can switch it off.
  const clubOnly = Boolean(club?.priceOnLabel && parsed.has_clubcard_price);
  let deal: DealInput | null = null;
  let dealState: FieldState = 'none';

  if (parsed.deal_type === 'price') {
    deal = { deal_type: 'price', deal_qty: parsed.deal_qty, deal_price: parsed.deal_price, deal_pay_qty: null, club_only: clubOnly };
    dealState = 'found';
    // "2 for €14" should work out cheaper per item than the shelf price
    if (price !== null && parsed.deal_qty && parsed.deal_price !== null && parsed.deal_price / parsed.deal_qty >= price) {
      dealState = 'check';
      notes.push("The deal doesn't work out cheaper than the shelf price. Please check.");
    }
  } else if (parsed.deal_type === 'qty') {
    // The parser stores "3 for 2" as deal_qty 3, deal_price 2 (the capstone's convention)
    deal = { deal_type: 'qty', deal_qty: parsed.deal_qty, deal_price: null, deal_pay_qty: parsed.deal_price, club_only: clubOnly };
    dealState = 'found';
  } else if (parsed.deal_qty_hint !== null) {
    // "3 for" was read but not what follows: pre-fill the quantity, ask for the rest
    deal = { deal_type: null, deal_qty: parsed.deal_qty_hint, deal_price: null, deal_pay_qty: null, club_only: clubOnly };
    dealState = 'check';
    notes.push(`Spotted a "${parsed.deal_qty_hint} for" deal but couldn't read the rest. Please complete it.`);
  }
  if (deal?.club_only && club) notes.push(`Deal marked as ${club.name} only.`);

  return {
    store,
    product_name: '',
    price,
    club_card_price: clubPrice,
    club_card_name: club?.name ?? null,
    deal,
    quantity: 1,
    state: { price: priceState, club_card_price: clubState, deal: dealState },
    notes,
    possiblyWeighed,
    parser_version: PARSER_VERSION,
    barcode: null,
    image_url: null,
    category: null,
  };
}

// After the shopper has checked the card. Returns null while the price is still empty
// or the deal is half-filled, so the "Add to basket" button can stay disabled.
export function draftToBasketItem(draft: ConfirmDraft, id: string, source: 'scan' | 'manual'): BasketItem | null {
  if (draft.price === null || draft.possiblyWeighed) return null;
  if (draft.deal && draft.deal.deal_type === null) return null;
  return {
    id,
    product_name: draft.product_name,
    store_name: draft.store,
    price: draft.price,
    club_card_price: draft.club_card_price,
    club_card_name: draft.club_card_name,
    deal: draft.deal,
    quantity: draft.quantity,
    source,
    barcode: draft.barcode,
    image_url: draft.image_url,
    category: draft.category,
  };
}
