// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// Looking up a barcode: checks the phone's own cache first, then asks
// Open Food Facts, and remembers what it found (saved under tralai.products.v1).
// With no signal, a product looked up before still works, even if it's old.
// hooks/useScanScreen.ts uses this; the confirm card never calls it directly.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef, useState } from 'react';
import { isValidBarcode } from '../lib/barcode';
import { addToCache, isFresh, readCache, type LookupProduct, type ProductCache } from '../lib/openFoodFacts';
import type { LookupStatus } from '../lib/productLookup';
import { fetchProduct } from '../services/productService';

const STORAGE_KEY = 'tralai.products.v1';

export function useProductLookup() {
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [product, setProduct] = useState<LookupProduct | null>(null);

  const busy = useRef(false);                     // one look-up at a time
  const ticket = useRef(0);                       // ignores an answer that arrives after reset
  const cache = useRef<ProductCache | null>(null); // read from the phone once

  const loadCache = async (): Promise<ProductCache> => {
    if (cache.current) return cache.current;
    try {
      cache.current = readCache(await AsyncStorage.getItem(STORAGE_KEY));
    } catch {
      cache.current = {};
    }
    return cache.current;
  };

  const remember = async (p: LookupProduct) => {
    cache.current = addToCache(await loadCache(), p);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache.current)).catch(() => {});
  };

  // Returns the product when found, otherwise null (the status says why)
  const lookUp = useCallback(async (barcodeText: string): Promise<LookupProduct | null> => {
    if (busy.current) return null;
    const barcode = barcodeText.replace(/\D/g, '');
    if (!isValidBarcode(barcode)) {
      setProduct(null);
      setStatus('invalid');
      return null;
    }

    busy.current = true;
    const mine = ++ticket.current;
    setProduct(null);
    setStatus('loading');

    const finish = (s: LookupStatus, p: LookupProduct | null) => {
      if (mine !== ticket.current) return null; // reset while waiting
      setProduct(p);
      setStatus(s);
      return p;
    };

    try {
      const cached = (await loadCache())[barcode] ?? null;
      if (cached && isFresh(cached, new Date())) return finish('found', cached);

      const result = await fetchProduct(barcode);
      if (result.kind === 'found') {
        remember(result.product);
        return finish('found', result.product);
      }
      if (result.kind === 'unavailable' && cached) return finish('found', cached); // old, but better than nothing
      return finish(result.kind, null);
    } finally {
      if (mine === ticket.current) busy.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    ticket.current++;
    busy.current = false;
    setProduct(null);
    setStatus('idle');
  }, []);

  return { status, product, lookUp, reset };
}
