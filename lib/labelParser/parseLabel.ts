// The app's Irish shelf-label parser.
//
// Starts from the capstone rules (extractFromOcr.ts, which stays frozen as the
// baseline) and adds:
//   - shared fixes that apply to every store            (marked SHARED)
//   - store-specific rules, switched on in storeProfiles.ts  (marked PROFILE)
//
// Measure every change with:  npx tsx scripts/scoreParser.ts

import type { OcrPiece, ParsedLabel } from './extractFromOcr';
import { findAll, minBy, pyRound, search } from './pyCompat';
import { profileFor, type StoreProfile } from './storeProfiles';

export type { OcrPiece, ParsedLabel };

// Bump this whenever the rules change, so test-mode records say which rules produced them.
export const PARSER_VERSION = '1.0.0';

type Piece = {
  text: string;
  height: number;
  cx: number;
  cy: number;
  w: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
};

function emptyOutput(): ParsedLabel {
  return {
    standard_price: null, clubcard_price: null, has_clubcard_price: false,
    deal_type: null, deal_qty: null, deal_price: null,
    unit_price: null, unit: null, brand: null, item_name: null,
    weight_volume: null, deposit_price: null,
  };
}

function toPiece(text: string, bbox: [number, number][]): Piece {
  const xs = bbox.map((pt) => pt[0]);
  const ys = bbox.map((pt) => pt[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { text, height: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, x0, x1, y0, y1 };
}

// ---------------------------------------------------------------
// Patterns (capstone originals unless marked)
// ---------------------------------------------------------------

const UNITS = '(kgm|kg|grm|g|litres?|ltre|ltr|l|mls?|each|unit|piece)';
const UNIT_PRICE_PATTERN = new RegExp(String.raw`€\s*(\d+[.,]?\d*)\s*(?:per\s+|\/)?\s*` + UNITS + String.raw`\b`, 'i');
const UNIT_PRICE_CENTS_PATTERN = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*c\b\s*(?:per\s+|\/)?\s*` + UNITS, 'i');
const UNIT_PRICE_EQUALS_PATTERN = new RegExp(String.raw`1\s*` + UNITS + String.raw`\s*=\s*€?\s*(\d+[.,]\d{2})`, 'i');
const UNIT_PRICE_SLASH_PATTERN = new RegExp(String.raw`[€E6C0]?(\d{1,3}[.,]\d{1,2})\s*[\/f]\s*` + UNITS, 'i');
const UNIT_PRICE_PER_PATTERN = new RegExp(String.raw`[€E6C0]?(\d{1,3}(?:[.,]\d{1,2})?)\s*per\s+` + UNITS + String.raw`\b`, 'i');
const UNIT_CANONICAL: Record<string, string> = {
  kgm: 'kg', kg: 'kg', grm: 'g', g: 'g',
  ltre: 'l', ltr: 'l', l: 'l', litre: 'l', litres: 'l',
  ml: 'ml', mls: 'ml', each: 'unit', unit: 'unit', piece: 'unit',
};

// SHARED (G2): the quantity is 1–2 digits and can't sit inside another number,
// so "1.751 for €5" and "€3.50 for €5" no longer give quantities of 751 or 50.
const DEAL_PATTERN = /(?<![\d.,])(\d{1,2})\s*for\s*€?\s*(\d+(?:\.\d{1,2})?)(?![a-zA-Z0-9])/i;

const CLUBCARD_KEYWORDS = ['clubcard', 'club card', 'lidl plus', 'rewards'];
const PRICE_PATTERN = /€?\s*(?<![\d.])(\d{1,3}\.\d{2})\b(?!\.\d)/;
const CENTS_PRICE_PATTERN = /(?<![\d.,])(\d{1,2})\s*c\b/;
const WHOLE_EURO_PATTERN = /€\s*(\d{1,4})\b(?!\s*[.,])/;
const DEPOSIT_PATTERN = new RegExp(
  String.raw`(?:deposit|drs)\D{0,15}?(?:€\s*(\d+\.\d{2})|(\d{1,2})\s*c\b)` +
  String.raw`|(?:€?\s*(\d+\.\d{2})|(\d{1,2})\s*c\b)\s*(?:drs\s+)?(?:deposit|drs)`,
  'i',
);
const MULTIPACK_PATTERN = /(?<!€)\b(\d{1,2}\s*x\s*\d+(?:[.,]\d+)?\s*(?:kgs?|grms?|gms?|g|mls?|cls?|ltrs?|l|m)?)\b/i;
const WEIGHT_PATTERN = /(?<!€)(?<!€ )\b(\d+(?:[.,]\d+)?)\s*(kgs?|grms?|gms?|g|mls?|cls?|ltrs?|l|packs?)\b/i;

// SHARED (G1): a line that states a price per kg / litre / metre is a unit price,
// never the shelf price or the club price. Catches OCR variants like "€17.89per ko".
const UNIT_LINE = /\d\s*per|\bper\b|kgm\b|ltr\b|\/\s*(?:kgm?|l|lt)\b/i;
const isUnitLine = (text: string) => UNIT_LINE.test(text);

// SHARED (G4): Irish shelves only use "cheapest free" for 3 for 2.
const CHEAPEST_FREE = /cheapest\s+(?:item|product)\s+free/i;

// PROFILE (Dunnes): "SAVE €1.50" or "SAVE 50c"
const SAVE_AMOUNT = /\bsave\s*(?:€\s*(\d{1,3}(?:\.\d{2})?)|(\d{1,2})\s*c\b)/i;

// PROFILE (Tesco): "Any 2" above "for €5"
const ANY_N = /^any\s*(\d{1,2})?$/i;
const FOR_EURO = /^for\s*€\s*(\d{1,3}(?:\.\d{2})?)$/i;

function classifyDeal(qtyStr: string, valueStr: string): ['price' | 'qty', number, number] {
  const qty = parseInt(qtyStr, 10);
  if (!valueStr.includes('.') && parseInt(valueStr, 10) < qty) return ['qty', qty, Number(valueStr)];
  return ['price', qty, Number(valueStr)];
}

const sameColumn = (p: Piece, q: Piece) => Math.abs(p.cx - q.cx) < Math.max(p.w, q.w);

// PROFILE (Tesco): join "€8" (or "€3.") with the small cents number printed to
// its right, "35", into one piece "€8.35". The cents sit within the height of
// the euro digits and close beside them.
function joinSuperscriptCents(pieces: Piece[]): Piece[] {
  const euroRe = /^€\s*(\d{1,3})\.?$/;
  const result = [...pieces];
  for (const cents of pieces) {
    if (!/^\d{2}$/.test(cents.text.trim())) continue;
    const options = result.filter((e) =>
      euroRe.test(e.text.trim()) &&
      cents.cx > e.cx &&
      cents.cy >= e.y0 && cents.cy <= e.y1 &&
      cents.height < e.height &&
      cents.x0 - e.x1 <= 1.2 * e.height,
    );
    if (options.length === 0) continue;
    const euro = minBy(options, (e) => cents.x0 - e.x1);
    const merged: Piece = {
      ...euro,
      text: `€${euroRe.exec(euro.text.trim())![1]}.${cents.text.trim()}`,
      x1: Math.max(euro.x1, cents.x1),
    };
    merged.w = merged.x1 - merged.x0;
    merged.cx = (merged.x0 + merged.x1) / 2;
    result[result.indexOf(euro)] = merged;
    result.splice(result.indexOf(cents), 1);
  }
  return result;
}

// ---------------------------------------------------------------
// The parser
// ---------------------------------------------------------------

export function parseLabel(ocrResult: OcrPiece[], store: string): ParsedLabel {
  const profile: StoreProfile = profileFor(store);
  const output = emptyOutput();

  let pieces = ocrResult.map(([bbox, text]) => toPiece(text, bbox as [number, number][]));
  if (profile.superscriptCents) pieces = joinSuperscriptCents(pieces);

  const fullText = pieces.map((p) => p.text).join(' ');
  const fullLower = fullText.toLowerCase();

  // ----- 1. Unit price -----
  let bestEach: [number, string] | null = null;
  let foundWeightUnit = false;
  for (const m of findAll(UNIT_PRICE_PATTERN, fullText)) {
    const u = UNIT_CANONICAL[m[2].toLowerCase()];
    const v = Number(m[1].replace(',', '.'));
    if (u !== 'unit') {
      output.unit_price = v; output.unit = u; foundWeightUnit = true;
      break;
    }
    if (bestEach === null && m[0].toLowerCase().includes('per')) bestEach = [v, u];
  }
  if (!foundWeightUnit && bestEach) [output.unit_price, output.unit] = bestEach;
  if (output.unit_price === null) {
    let m = search(UNIT_PRICE_CENTS_PATTERN, fullText);
    if (m) {
      output.unit_price = pyRound(Number(m[1]) / 100, 3);
      output.unit = UNIT_CANONICAL[m[2].toLowerCase()];
    } else if ((m = search(UNIT_PRICE_EQUALS_PATTERN, fullText))) {
      output.unit_price = Number(m[2].replace(',', '.'));
      output.unit = UNIT_CANONICAL[m[1].toLowerCase()];
    } else if ((m = search(UNIT_PRICE_SLASH_PATTERN, fullText))) {
      output.unit_price = Number(m[1].replace(',', '.'));
      output.unit = UNIT_CANONICAL[m[2].toLowerCase()];
    } else if ((m = search(UNIT_PRICE_PER_PATTERN, fullText))) {
      output.unit_price = Number(m[1].replace(',', '.'));
      output.unit = UNIT_CANONICAL[m[2].toLowerCase()];
    }
  }

  // ----- 2. Deals -----
  const setDeal = ([t, q, p]: ['price' | 'qty', number, number]) => {
    output.deal_type = t; output.deal_qty = q; output.deal_price = p;
  };

  // 2a. PROFILE (Tesco): "Any 2" with "for €5" below it in the same column
  if (profile.anyNForDeal) {
    for (const any of pieces) {
      const am = ANY_N.exec(any.text.trim());
      if (!am || !am[1]) continue;
      const below = pieces.filter((p) => p.cy > any.cy && sameColumn(p, any) && FOR_EURO.test(p.text.trim()));
      if (below.length === 0) continue;
      const forPiece = minBy(below, (p) => p.cy - any.cy);
      setDeal(['price', parseInt(am[1], 10), Number(FOR_EURO.exec(forPiece.text.trim())![1])]);
      break;
    }
  }

  // 2b. Deal written in one line: "2 for €10"
  if (output.deal_type === null) {
    const dm = search(DEAL_PATTERN, fullLower);
    if (dm) setDeal(classifyDeal(dm[1], dm[2]));
  }

  // 2c. Deal stacked vertically: "2" / "for" / "€7"
  if (output.deal_type === null) {
    for (const f of pieces) {
      const am = /^(?:(\d{1,2})\s*)?for$/i.exec(f.text.trim());
      if (!am) continue;
      let qty = am[1] ?? null;
      if (qty === null) {
        const above = pieces.filter((p) => /^\d{1,2}$/.test(p.text.trim()) && p.cy < f.cy && sameColumn(p, f));
        if (above.length === 0) continue;
        qty = minBy(above, (p) => f.cy - p.cy).text.trim();
      }
      const below: [Piece, number][] = [];
      for (const p of pieces) {
        if (p.cy <= f.cy || !sameColumn(p, f) || isUnitLine(p.text)) continue; // SHARED (G1)
        const pm = /(\d{1,3}\.\d{2})/.exec(p.text);
        const wm = search(WHOLE_EURO_PATTERN, p.text);
        if (pm) below.push([p, Number(pm[1])]);
        else if (/^\d{3}$/.test(p.text.trim())) below.push([p, parseInt(p.text.trim(), 10) / 100]);
        else if (wm) below.push([p, Number(wm[1])]); // SHARED: whole euros, "€7"
      }
      if (below.length > 0) {
        const [, priceVal] = minBy(below, (t) => t[0].cy - f.cy);
        setDeal(classifyDeal(qty, priceVal.toFixed(2)));
        break;
      }
    }
  }

  // 2d. SHARED (G4): "Cheapest Item Free" is always 3 for 2
  if (CHEAPEST_FREE.test(fullText)) setDeal(['qty', 3, 2]);

  // For "3 for 2" the 2 is a count, not a price, so it must not block a €2 shelf price.
  const dealPriceAmount = output.deal_type === 'price' ? output.deal_price : null;

  // ----- 3. Deposit -----
  const dep = search(DEPOSIT_PATTERN, fullLower);
  if (dep) {
    const euro = dep[1] ?? dep[3];
    const cents = dep[2] ?? dep[4];
    if (euro) output.deposit_price = Number(euro);
    else if (cents) output.deposit_price = pyRound(parseInt(cents, 10) / 100, 2);
  }

  // ----- 4. Club card price -----
  const piecePrice = (p: Piece): number | null => {
    const pm = search(PRICE_PATTERN, p.text);
    if (pm) return Number(pm[1]);
    const cm = search(CENTS_PRICE_PATTERN, p.text);
    if (cm) return pyRound(parseInt(cm[1], 10) / 100, 2);
    const wm = search(WHOLE_EURO_PATTERN, p.text);
    if (wm) return Number(wm[1]);
    if (/^\d{3}$/.test(p.text.trim())) return parseInt(p.text.trim(), 10) / 100;
    return null;
  };
  const hasKeyword = (lower: string) => CLUBCARD_KEYWORDS.some((kw) => lower.includes(kw));
  const dist = (p: Piece, q: Piece) => ((p.cx - q.cx) ** 2 + (p.cy - q.cy) ** 2) ** 0.5;

  for (const kwPiece of pieces) {
    const pl = kwPiece.text.toLowerCase();
    if (!hasKeyword(pl)) continue;
    output.has_clubcard_price = true;
    if (pl.includes('without')) continue;
    const own = piecePrice(kwPiece);
    if (own !== null) {
      output.clubcard_price = own;
      break;
    }
    const candidates: [number, number][] = [];
    const withoutPieces = pieces.filter((p) => p.text.toLowerCase().includes('without') && hasKeyword(p.text.toLowerCase()));
    const eqRows = pieces.filter((q) => q.text.includes('='));
    for (const p of pieces) {
      if (
        p === kwPiece || !sameColumn(p, kwPiece) || p.text.includes('=') ||
        isUnitLine(p.text) || // SHARED (G1)
        eqRows.some((q) => Math.abs(p.cy - q.cy) < Math.max(p.height, q.height) / 2)
      ) continue;
      const val = piecePrice(p);
      if (val === null || val === dealPriceAmount || val === output.deposit_price || val === output.unit_price) continue;
      const dKw = dist(p, kwPiece);
      if (withoutPieces.length > 0 && Math.min(...withoutPieces.map((w) => dist(p, w))) < dKw) continue;
      candidates.push([dKw, val]);
    }
    if (candidates.length > 0) {
      output.clubcard_price = candidates.reduce((best, c) =>
        c[0] < best[0] || (c[0] === best[0] && c[1] < best[1]) ? c : best,
      )[1];
    }
    break;
  }

  // ----- 5. Weight / volume -----
  for (const p of pieces) {
    if (p.text.includes('=')) continue;
    if (/^1\s*(kgm|kg|ltre|ltr|l|litre)\s*[-=]/i.test(p.text.trim())) continue;
    const mm = search(MULTIPACK_PATTERN, p.text);
    if (mm) { output.weight_volume = mm[1].toLowerCase().replace(/ /g, ''); break; }
    const wm = search(WEIGHT_PATTERN, p.text);
    if (wm) { output.weight_volume = `${wm[1]}${wm[2].toLowerCase()}`; break; }
  }

  // ----- 6. Item text -----
  const textPieces = pieces.filter((p) => !search(PRICE_PATTERN, p.text) && !/^\d+$/.test(p.text.trim())).map((p) => p.text);
  if (textPieces.length > 0) output.item_name = textPieces.join(' ');

  // ----- 7. Shelf price: the biggest price on the label -----
  const exclude = [output.unit_price, output.clubcard_price, dealPriceAmount, output.deposit_price];
  const guardRows = pieces.filter((g) => /\bsave\b|\btotal\b/i.test(g.text));
  const rowGuarded = (p: Piece, rows: Piece[]) =>
    rows.some((g) => Math.abs(p.cy - g.cy) < Math.max(p.height, g.height) / 2);

  const priceCandidates: { value: number; height: number }[] = [];
  for (const p of pieces) {
    const pl = p.text.toLowerCase();
    if (pl.includes('save') || pl.includes('total') || rowGuarded(p, guardRows) || isUnitLine(p.text)) continue;
    for (const pm of findAll(PRICE_PATTERN, p.text)) {
      const val = Number(pm[1]);
      if (!exclude.includes(val)) priceCandidates.push({ value: val, height: p.height });
    }
    for (const pm of findAll(CENTS_PRICE_PATTERN, p.text)) {
      const val = pyRound(parseInt(pm[1], 10) / 100, 2);
      if (!exclude.includes(val)) priceCandidates.push({ value: val, height: p.height });
    }
    for (const pm of findAll(WHOLE_EURO_PATTERN, p.text)) {
      const val = Number(pm[1]);
      if (!exclude.includes(val)) priceCandidates.push({ value: val, height: p.height });
    }
  }
  if (priceCandidates.length > 0) {
    priceCandidates.sort((a, b) => b.height - a.height);
    output.standard_price = priceCandidates[0].value;
  }

  // ----- 7b. PROFILE (Dunnes): price you pay = struck-through price − SAVE amount -----
  // The struck-through price sits directly above "SAVE" in the same column.
  // A "Total Price" (price plus deposit) is never the struck-through price.
  if (profile.saveArithmetic) {
    const totalRows = pieces.filter((g) => /\btotal\b/i.test(g.text));
    for (const s of pieces) {
      const sm = SAVE_AMOUNT.exec(s.text);
      if (!sm) continue;
      const saving = sm[1] ? Number(sm[1]) : parseInt(sm[2], 10) / 100;
      const above = pieces.filter((p) =>
        p !== s && p.cy < s.cy && sameColumn(p, s) && !isUnitLine(p.text) &&
        !/\btotal\b/i.test(p.text) && !rowGuarded(p, totalRows) && search(PRICE_PATTERN, p.text),
      );
      if (above.length === 0) continue;
      const was = Number(search(PRICE_PATTERN, minBy(above, (p) => s.cy - p.cy).text)![1]);
      const now = pyRound(was - saving, 2);
      if (now > 0) {
        output.standard_price = now;
        break;
      }
    }
  }

  return output;
}
