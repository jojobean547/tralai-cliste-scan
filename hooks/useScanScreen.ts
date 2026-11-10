// Everything the Scan screen does: which store you're in (remembered on the phone),
// which step you're on, and the confirm card while it's being filled in.
// The rules themselves live in lib/confirmForm.ts. Barcode look-ups come from
// hooks/useProductLookup.ts; what they fill in is in lib/productLookup.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clubCardFor } from '../constants/stores';
import { newLineId } from '../lib/basket';
import { euro } from '../lib/basketDisplay';
import {
  checkForm, chooseDeal as chooseDealRule, emptyForm, formToBasketItem,
  type ConfirmForm, type DealChoice, type FormErrors,
} from '../lib/confirmForm';
import { barcodeKind } from '../lib/barcode';
import type { LookupProduct } from '../lib/openFoodFacts';
import { applyProduct, lookupMessage, lookupTone, nameForCard } from '../lib/productLookup';
import { useBarcodeScanner } from './useBarcodeScanner';
import { useBasket } from './useBasket';
import { useProductLookup } from './useProductLookup';

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

  const lookup = useProductLookup();
  // What the last look-up filled in, so it can be taken back out if the
  // shopper then changes the barcode. name is null when the shopper had typed their own.
  const filledBy = useRef<{ barcode: string; name: string | null; imageUrl: string | null } | null>(null);

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
    lookup.reset();
    filledBy.current = null;
  };

  const { reset: resetLookup } = lookup;
  const setField = useCallback(<K extends keyof ConfirmForm>(key: K, value: ConfirmForm[K]) => {
    if (key === 'barcodeText') {
      // A changed barcode means any earlier look-up no longer applies
      resetLookup();
      const filled = filledBy.current;
      const digits = String(value).replace(/\D/g, '');
      if (filled && digits !== filled.barcode) {
        filledBy.current = null;
        setForm((prev) => ({
          ...prev,
          barcodeText: String(value),
          name: filled.name !== null && prev.name === filled.name ? '' : prev.name,
          imageUrl: filled.imageUrl !== null && prev.imageUrl === filled.imageUrl ? null : prev.imageUrl,
        }));
        return;
      }
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }, [resetLookup]);

  // text and currentName are passed in after a camera scan, when the form on
  // screen hasn't caught up yet; a tap on "Look up" uses what's on the card
  const fillFrom = (p: LookupProduct, currentName: string) => {
    const keptOwnName = currentName.trim() !== '';
    filledBy.current = { barcode: p.barcode, name: keptOwnName ? null : nameForCard(p), imageUrl: p.image_url };
    setForm((prev) => applyProduct(prev, p));
  };

  const lookUpBarcode = async (text: string = form.barcodeText, currentName: string = form.name) => {
    const p = await lookup.lookUp(text);
    if (!p) return;
    // A shop's own code is only a suggestion: nothing is filled in until "Use this"
    if (barcodeKind(p.barcode) === 'storeCode') return;
    fillFrom(p, currentName);
  };

  // "Use this" on a suggested product
  const acceptSuggestion = () => {
    if (lookup.status !== 'suggested' || !lookup.product) return;
    const nameWasFilled = filledBy.current !== null && filledBy.current.name === form.name;
    fillFrom(lookup.product, nameWasFilled ? '' : form.name);
    lookup.accept();
  };

  // A scanned barcode goes into the box and is looked up straight away.
  // A name the last look-up filled in doesn't count as the shopper's own.
  const scanner = useBarcodeScanner((barcode) => {
    const nameWasFilled = filledBy.current !== null && filledBy.current.name === form.name;
    setField('barcodeText', barcode);
    lookUpBarcode(barcode, nameWasFilled ? '' : form.name);
  });

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

    lookupStatus: lookup.status,
    lookupMessage: lookupMessage(lookup.status),
    lookupTone: lookupTone(lookup.status),
    lookUpBarcode: () => lookUpBarcode(),
    // A suggested product (shop's own code), shown with "Use this" / "Not this one"
    suggestion:
      lookup.status === 'suggested' && lookup.product
        ? { name: nameForCard(lookup.product), imageUrl: lookup.product.image_url }
        : null,
    acceptSuggestion,
    rejectSuggestion: () => lookup.reset(),

    scanBarcode: scanner.open,
    scannerOpen: scanner.isOpen,
    onBarcodeScanned: scanner.onScanned,
    closeScanner: scanner.close,
    cameraMessage: scanner.message,
    cameraBlocked: scanner.cameraBlocked,
    openCameraSettings: scanner.openSettings,

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
