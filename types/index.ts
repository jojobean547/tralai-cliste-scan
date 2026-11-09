// The app's data dictionary.

// A deal as the shopper confirms it on the confirm card.
//   'price' = "3 for €4":  deal_qty 3, deal_price 4
//   'qty'   = "3 for 2":   deal_qty 3, deal_pay_qty 2 (cheapest one free)
export type DealInput = {
  deal_type: 'price' | 'qty' | null;
  deal_price: number | null;
  deal_qty: number | null;
  deal_pay_qty: number | null;
  club_only: boolean; // only for club card holders, e.g. Tesco "Any 2 for €5"
};

// One line in the basket.
export type BasketItem = {
  id: string;
  product_name: string;
  store_name: string;
  price: number;                   // the regular shelf price
  club_card_price: number | null;  // the price with the store's club card, if shown
  club_card_name: string | null;   // e.g. 'Tesco Clubcard', from the store, not the label
  deal: DealInput | null;
  quantity: number;
  source: 'scan' | 'manual';
};
