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
  | { kind: 'notFound' }                       // the food database answered and nobody has it
  | { kind: 'unavailable'; reason: string };   // the food database couldn't answer, and why

// What one database said. 'failed' carries the reason, e.g. 'busy (HTTP 429)'.
type OneAnswer =
  | { kind: 'found'; product: LookupProduct }
  | { kind: 'notFound' }
  | { kind: 'failed'; reason: string; retry: boolean } // retry = worth asking once more
  | { kind: 'noConnection'; reason: string };

const RETRY_WAIT_MS = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function askOnce(host: string, source: ProductSource, barcode: string): Promise<OneAnswer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(productUrl(host, barcode), {
      headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 404) return { kind: 'notFound' };
    if (res.status === 429) return { kind: 'failed', reason: 'too many requests (HTTP 429)', retry: true };
    if (res.status >= 500) return { kind: 'failed', reason: `server problem (HTTP ${res.status})`, retry: true };
    if (!res.ok) return { kind: 'failed', reason: `refused (HTTP ${res.status})`, retry: false };
    let reply: unknown;
    try {
      reply = await res.json();
    } catch {
      return { kind: 'failed', reason: 'reply was not readable', retry: true };
    }
    const product = parseProductReply(reply, barcode, source, new Date());
    return product ? { kind: 'found', product } : { kind: 'notFound' };
  } catch {
    // fetch itself failed: no signal, or the database took too long
    return { kind: 'noConnection', reason: controller.signal.aborted ? `no answer within ${TIMEOUT_MS / 1000} s` : 'no internet connection' };
  } finally {
    clearTimeout(timer);
  }
}

// A busy or briefly broken database gets one more try after a short wait
async function askOne(host: string, source: ProductSource, barcode: string): Promise<OneAnswer> {
  const first = await askOnce(host, source, barcode);
  if (first.kind !== 'failed' || !first.retry) return first;
  await sleep(RETRY_WAIT_MS);
  return askOnce(host, source, barcode);
}

// Food first, then beauty, then household. The food database decides:
// if it couldn't answer, the result is 'unavailable'. If it answered "not found"
// and a later one couldn't answer, the result is still 'notFound', since
// groceries are almost always in the food database.
export async function fetchProduct(barcode: string): Promise<FetchResult> {
  for (const [i, { host, source }] of OFF_HOSTS.entries()) {
    const answer = await askOne(host, source, barcode);
    if (answer.kind === 'found') return answer;
    if (answer.kind === 'noConnection') {
      // don't wait on the others
      return i === 0 ? { kind: 'unavailable', reason: answer.reason } : { kind: 'notFound' };
    }
    if (answer.kind === 'failed' && i === 0) return { kind: 'unavailable', reason: `${source}: ${answer.reason}` };
  }
  return { kind: 'notFound' };
}
