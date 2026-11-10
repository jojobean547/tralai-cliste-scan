// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tralaí Cliste Contributors
//
// The only file that talks to Open Food Facts over the internet.
// It asks the food database first, then beauty, then household products,
// and stops at the first match. The reading and tidying rules are in
// lib/openFoodFacts.ts.
//
// If a backend is added later, it slots in here: the rest of the app only
// calls fetchProduct() and never knows where the answer came from.

import { OFF_HOSTS, parseProductReply, productUrl, type LookupProduct, type ProductSource } from '../lib/openFoodFacts';

// Open Food Facts asks every app to say who it is and how to contact it.
// To change the address, change this one line.
export const OFF_CONTACT = 'hello@tralaicliste.ie';
export const OFF_USER_AGENT = `TralaiCliste/1.0 (${OFF_CONTACT})`;

const TIMEOUT_MS = 8000; // give up on one database after 8 seconds

export type FetchResult =
  | { kind: 'found'; product: LookupProduct }
  | { kind: 'notFound' }       // every database answered, none has it
  | { kind: 'unavailable' };   // no internet, or a database didn't answer

type OneAnswer = FetchResult | { kind: 'noConnection' };

async function askOne(host: string, source: ProductSource, barcode: string): Promise<OneAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(productUrl(host, barcode), {
      headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return { kind: 'notFound' };
    if (!res.ok) return { kind: 'unavailable' }; // busy or down, e.g. 429 or 503
    let reply: unknown;
    try {
      reply = await res.json();
    } catch {
      return { kind: 'unavailable' };
    }
    const product = parseProductReply(reply, barcode, source, new Date());
    return product ? { kind: 'found', product } : { kind: 'notFound' };
  } catch {
    // fetch itself failed or timed out: most likely no signal
    return { kind: 'noConnection' };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchProduct(barcode: string): Promise<FetchResult> {
  let missedOne = false;
  for (const { host, source } of OFF_HOSTS) {
    const answer = await askOne(host, source, barcode);
    if (answer.kind === 'found') return answer;
    if (answer.kind === 'noConnection') return { kind: 'unavailable' }; // don't wait on the other two
    if (answer.kind === 'unavailable') missedOne = true;
  }
  return missedOne ? { kind: 'unavailable' } : { kind: 'notFound' };
}
