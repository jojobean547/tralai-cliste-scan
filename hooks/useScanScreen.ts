// Everything the Scan screen does: which store you're in (remembered on the phone),
// which step you're on, and the confirm card while it's being filled in.
// The rules themselves live in lib/confirmForm.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clubCardFor } from '../constants/stores';
import { newLineId } from '../lib/basket';
import { euro } from '../lib/basketDisplay';
import {
  checkForm, chooseDeal as chooseDealRule, emptyForm, formToBasketItem,
  type ConfirmForm, type DealChoice, type FormErrors,
} from '../lib/confirmForm';
import { useBasket } from './useBasket';

const STORAGE_KEY = 'tralai.trip.v1';

// pickStore → ready → confirm → (Add) → ready …
export type ScanStep = 'pickStore' | 'ready' | 'confirm';

export function useScanScreen() {
  const { addItem, itemCount, total } = useBasket();

  const [store, setStore] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [entering, setEntering] = useState(false);
  const [form, setForm] = useState<ConfirmForm>(emptyForm());
  const [notes, setNotes] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false); // only after the first "Add" tap
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  // Remember the store between visits to the app
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && typeof saved.store === 'string') setStore(saved.store);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ store })).catch(() => {});
  }, [store, loaded]);

  const clubCard = store ? clubCardFor(store) : null;
  const check = useMemo(() => checkForm(form, clubCard), [form, clubCard]);
  const step: ScanStep = !store ? 'pickStore' : entering ? 'confirm' : 'ready';

  const resetCard = () => {
    setForm(emptyForm());
    setNotes([]);
    setShowErrors(false);
  };

  const setField = useCallback(<K extends keyof ConfirmForm>(key: K, value: ConfirmForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  return {
    loaded,
    step,
    store,
    clubCard,
    itemCount,
    total,
    lastAdded,

    chooseStore: (s: string) => setStore(s),
    changeStore: () => {
      setStore(null);
      setEntering(false);
      resetCard();
    },

    startManualEntry: () => {
      resetCard();
      setLastAdded(null);
      setEntering(true);
    },
    cancelEntry: () => {
      setEntering(false);
      resetCard();
    },

    form,
    notes,
    errors: (showErrors ? check.errors : {}) as FormErrors,
    setField,
    chooseDeal: (choice: DealChoice) => setForm((prev) => chooseDealRule(prev, choice)),

    // Returns false (and shows what's missing) if the card isn't complete yet
    addToBasket: (): boolean => {
      if (!store) return false;
      const item = formToBasketItem(form, store, clubCard, newLineId(), 'manual');
      if (!item) {
        setShowErrors(true);
        return false;
      }
      addItem(item);
      setLastAdded(`${item.product_name || 'Item'} added, ${euro(item.price)}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`);
      setEntering(false);
      resetCard();
      return true;
    },
  };
}
