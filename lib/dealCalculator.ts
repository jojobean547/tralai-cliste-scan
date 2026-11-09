import type { BasketItem } from '../types';

type HasClubCard = (cardName: string) => boolean;

// Rounds to whole cents, so totals never show €2.4000000001
const round2 = (n: number) => Math.round(n * 100) / 100;

const shopperHasCard = (item: BasketItem, hasClubCard: HasClubCard) =>
  item.club_card_name !== null && hasClubCard(item.club_card_name);

// The price of one item: the club card price if the shopper has that card
export function unitPrice(item: BasketItem, hasClubCard: HasClubCard): number {
  if (item.club_card_price !== null && shopperHasCard(item, hasClubCard)) return item.club_card_price;
  return item.price;
}

// A club-only deal counts only for shoppers with that card
function dealApplies(item: BasketItem, hasClubCard: HasClubCard): boolean {
  if (!item.deal || item.deal.deal_type === null) return false;
  return !item.deal.club_only || shopperHasCard(item, hasClubCard);
}

// The total for one basket line, with any deal applied
export function lineTotal(item: BasketItem, hasClubCard: HasClubCard): number {
  const price = unitPrice(item, hasClubCard);
  const qty = item.quantity;
  const deal = item.deal;

  if (deal && dealApplies(item, hasClubCard)) {
    // "3 for €4": each full group of 3 costs €4, any extras cost the normal price
    if (deal.deal_type === 'price' && deal.deal_qty && deal.deal_qty >= 2 && deal.deal_price !== null) {
      const groups = Math.floor(qty / deal.deal_qty);
      const leftover = qty % deal.deal_qty;
      return round2(groups * deal.deal_price + leftover * price);
    }
    // "3 for 2": in each full group of 3 you pay for 2, any extras cost the normal price
    if (deal.deal_type === 'qty' && deal.deal_qty && deal.deal_pay_qty !== null && deal.deal_pay_qty < deal.deal_qty) {
      const groups = Math.floor(qty / deal.deal_qty);
      const leftover = qty % deal.deal_qty;
      return round2((groups * deal.deal_pay_qty + leftover) * price);
    }
  }
  return round2(qty * price);
}

// How much the shopper saves on one line, compared with the regular shelf price
export function lineSaving(item: BasketItem, hasClubCard: HasClubCard): number {
  return round2(item.quantity * item.price - lineTotal(item, hasClubCard));
}

// The whole basket
export function basketTotal(items: BasketItem[], hasClubCard: HasClubCard): number {
  return round2(items.reduce((sum, item) => sum + lineTotal(item, hasClubCard), 0));
}
