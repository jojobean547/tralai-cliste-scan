export const STORES: string[] = [
  'Aldi',
  'Centra',
  'Dunnes Stores',
  'Lidl',
  'Spar',
  'SuperValu',
  'Tesco',
];

export type ClubCardInfo = {
  name: string;           // as shown on the Settings screen
  priceOnLabel: boolean;  // is the club price printed on the shelf label?
};

// Dunnes VALUEclub discounts are applied at the checkout, never on the shelf label,
// so they can't be scanned. Aldi, Centra and Spar have no club card prices.
const CLUB_CARDS: Record<string, ClubCardInfo> = {
  tesco: { name: 'Tesco Clubcard', priceOnLabel: true },
  lidl: { name: 'Lidl Plus', priceOnLabel: true },
  supervalu: { name: 'Real Rewards', priceOnLabel: true },
  dunnes: { name: 'VALUEclub', priceOnLabel: false },
};

// Accepts 'Dunnes Stores' or 'Dunnes', any capitalisation.
export function clubCardFor(store: string): ClubCardInfo | null {
  const key = store.trim().toLowerCase().split(/\s+/)[0];
  return CLUB_CARDS[key] ?? null;
}
