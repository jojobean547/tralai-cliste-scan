// The shopping basket, shared by every screen and kept on the phone between visits.
// The rules live in lib/basket.ts and lib/dealCalculator.ts; this file only
// holds the basket in memory, saves it, and hands it to the screens.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { addLine, readSavedBasket, removeLine, setQuantity, summarise, updateLine } from '../lib/basket';
import { lineTotal } from '../lib/dealCalculator';
import type { BasketItem } from '../types';
import { useClubCards } from './useClubCards';

const STORAGE_KEY = 'tralai.basket.v1';

type BasketContextType = {
  items: BasketItem[];
  loaded: boolean;                      // false for a moment while the saved basket is read
  addItem: (item: BasketItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;   // 0 removes the line
  updateItem: (id: string, changes: Partial<Omit<BasketItem, 'id'>>) => void;
  clearBasket: () => void;
  lineTotal: (item: BasketItem) => number;  // one line, deals and club prices applied
  total: number;
  itemCount: number;
  saving: number;                       // compared with every item at its regular shelf price
};

const BasketContext = createContext<BasketContextType | null>(null);

export function BasketProvider({ children }: { children: ReactNode }) {
  const { hasClubCard } = useClubCards();
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load the saved basket once when the app starts
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setItems(readSavedBasket(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Save after every change (not before loading, or the empty start would wipe the saved basket)
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items, loaded]);

  const value = useMemo<BasketContextType>(() => ({
    items,
    loaded,
    addItem: (item) => setItems((prev) => addLine(prev, item)),
    removeItem: (id) => setItems((prev) => removeLine(prev, id)),
    updateQuantity: (id, quantity) => setItems((prev) => setQuantity(prev, id, quantity)),
    updateItem: (id, changes) => setItems((prev) => updateLine(prev, id, changes)),
    clearBasket: () => setItems([]),
    lineTotal: (item) => lineTotal(item, hasClubCard),
    ...summarise(items, hasClubCard),
  }), [items, loaded, hasClubCard]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const context = useContext(BasketContext);
  if (!context) throw new Error('useBasket must be used inside a BasketProvider');
  return context;
}
