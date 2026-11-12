// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The shopping history, shared by every screen and kept on the phone.
// The rules are in lib/history.ts. useFinishShop() turns the basket into
// finished shops; the Basket and Scan screens both use it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { newLineId } from '../lib/basket';
import { addShops, finishSummary, readSavedHistory, removeShop, shopsFromBasket, type Shop } from '../lib/history';
import { useBasket } from './useBasket';
import { useClubCards } from './useClubCards';

const STORAGE_KEY = 'tralai.history.v1';

type HistoryContextType = {
  shops: Shop[];               // newest first
  loaded: boolean;
  add: (shops: Shop[]) => void;
  remove: (id: string) => void;
};

const HistoryContext = createContext<HistoryContextType | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setShops(readSavedHistory(raw)))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Save after every change, but not before loading, or the empty start would wipe it
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shops)).catch(() => {});
  }, [shops, loaded]);

  const value = useMemo<HistoryContextType>(() => ({
    shops,
    loaded,
    add: (more) => setShops((prev) => addShops(prev, more)),
    remove: (id) => setShops((prev) => removeShop(prev, id)),
  }), [shops, loaded]);

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) throw new Error('useHistory must be used inside a HistoryProvider');
  return context;
}

// Finishing the shop: saves the basket to the history (one shop per store) and empties it
export function useFinishShop() {
  const { items, clearBasket } = useBasket();
  const { hasClubCard } = useClubCards();
  const { add } = useHistory();

  // What would be saved right now, for the question before finishing
  const preview = useMemo(() => shopsFromBasket(items, hasClubCard, new Date(), () => ''), [items, hasClubCard]);

  const finish = useCallback(() => {
    const shops = shopsFromBasket(items, hasClubCard, new Date(), newLineId);
    if (shops.length === 0) return;
    add(shops);
    clearBasket();
  }, [items, hasClubCard, add, clearBasket]);

  return {
    canFinish: preview.length > 0,
    summary: finishSummary(preview),      // "Lidl €23.40 and Dunnes Stores €15.10"
    storeCount: preview.length,
    stores: preview.map((s) => s.store),
    finish,
  };
}
