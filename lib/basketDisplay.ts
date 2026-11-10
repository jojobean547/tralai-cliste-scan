// What the Basket screen shows for each line, worked out here so it can be
// tested on the computer:  npx tsx scripts/checkBasket.ts
// The screen and components only lay this text out.

import { categoryIcon } from '../constants/categories';
import type { BasketItem, DealInput } from '../types';
import { lineSaving, lineTotal, unitPrice } from './dealCalculator';

type HasClubCard = (cardName: string) => boolean;

export const euro = (n: number) => `€${n.toFixed(2)}`;

export function describeDeal(deal: DealInput | null): string | null {
  if (!deal || deal.deal_type === null || !deal.deal_qty) return null;
  if (deal.deal_type === 'price' && deal.deal_price !== null) return `${deal.deal_qty} for ${euro(deal.deal_price)}`;
  if (deal.deal_type === 'qty' && deal.deal_pay_qty !== null) return `${deal.deal_qty} for ${deal.deal_pay_qty}`;
  return null;
}

export type LineIcon = { kind: 'image'; uri: string } | { kind: 'category'; name: string };

export type LineDisplay = {
  icon: LineIcon;             // product photo if there is one, otherwise the category icon
  title: string;              // product name, or "Item 3" when none was typed
  eachText: string;           // "€1.20 each"
  clubText: string | null;    // club price, applied or not
  dealText: string | null;    // "3 for 2", "2 for €5.00 · Tesco Clubcard only"
  dealNote: string | null;    // why a deal isn't counting
  totalText: string;          // the line total, deals and club prices applied
  savingText: string | null;  // "You save €1.20"
};

export function describeLine(item: BasketItem, position: number, hasClubCard: HasClubCard): LineDisplay {
  const card = item.club_card_name;
  const hasCard = card !== null && hasClubCard(card);

  let clubText: string | null = null;
  if (item.club_card_price !== null && card) {
    clubText = hasCard
      ? `${card} price (regular ${euro(item.price)})`
      : `${euro(item.club_card_price)} with ${card}, off in Settings`;
  }

  const deal = describeDeal(item.deal);
  const clubOnly = Boolean(item.deal?.club_only && card);
  const dealText = deal ? (clubOnly ? `${deal} · ${card} only` : deal) : null;

  let dealNote: string | null = null;
  if (deal && clubOnly && !hasCard) {
    dealNote = `Not counted: ${card} is off in Settings`;
  } else if (deal && item.deal?.deal_qty && item.quantity < item.deal.deal_qty) {
    const more = item.deal.deal_qty - item.quantity;
    dealNote = `Add ${more} more to get the deal`;
  }

  const saving = lineSaving(item, hasClubCard);
  return {
    icon: item.image_url ? { kind: 'image', uri: item.image_url } : { kind: 'category', name: categoryIcon(item.category) },
    title: item.product_name.trim() || `Item ${position}`,
    eachText: `${euro(unitPrice(item, hasClubCard))} each`,
    clubText,
    dealText,
    dealNote,
    totalText: euro(lineTotal(item, hasClubCard)),
    savingText: saving > 0 ? `You save ${euro(saving)}` : null,
  };
}

// Club cards that would lower this basket but are switched off in Settings
export function cardsWorthSwitchingOn(items: BasketItem[], hasClubCard: HasClubCard): string[] {
  const names = new Set<string>();
  for (const item of items) {
    const card = item.club_card_name;
    if (!card || hasClubCard(card)) continue;
    if (item.club_card_price !== null || item.deal?.club_only) names.add(card);
  }
  return [...names];
}
