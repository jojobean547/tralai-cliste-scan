// Irish shelf-label parser: a faithful TypeScript port of extract_from_ocr()
// from the capstone notebook capstone_p2b_paddleocr.ipynb (Cells 3 and 5, frozen).
//
// RULE: this file must behave exactly like the Python. Do not improve it here.
// scripts/checkPort.ts proves that it does, field by field, on all 207 labels.
// Store-specific improvements come later, in a separate step.

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type Point = [number, number];

// One piece of text found by the OCR engine: [four corner points, text, confidence]
export type OcrPiece = [Point[], string, number];

// Same fields and names as the capstone's shared output schema
export type ParsedLabel = {
  standard_price: number | null;
  clubcard_price: number | null;
  has_clubcard_price: boolean;
  deal_type: 'price' | 'qty' | null;
  deal_qty: number | null;
  deal_price: number | null;
  unit_price: number | null;
  unit: string | null;
  brand: string | null;
  item_name: string | null;
  weight_volume: string | null;
  deposit_price: number | null;
};

type Piece = { text: string; height: number; cx: number; cy: number; w: number };

function createEmptyOutput(): ParsedLabel {
  return {
    standard_price: null,
    clubcard_price: null,
    has_clubcard_price: false,
    deal_type: null,
    deal_qty: null,
    deal_price: null,
    unit_price: null,
    unit: null,
    brand: null,
    item_name: null,
    weight_volume: null,
    deposit_price: null,
  };
}

// ---------------------------------------------------------------
// Python-compatible helpers
// ---------------------------------------------------------------

// Python's round(x, n). It rounds the exact stored value and sends exact
// halves to the even digit. JavaScript's Math.round sends halves up, so a
// plain Math.round version could differ by a cent on rare values.
export function pyRound(x: number, n: number): number {
  const negative = x < 0;
  const [intPart, frac] = Math.abs(x).toFixed(100).split('.');
  const kept = frac.slice(0, n);
  const rest = frac.slice(n);
  let digits = BigInt(intPart + kept);
  const first = rest[0];
  const restIsExactHalf = first === '5' && /^0*$/.test(rest.slice(1));
  if (first > '5' || (first === '5' && !restIsExactHalf)) {
    digits += 1n;
  } else if (restIsExactHalf && digits % 2n === 1n) {
    digits += 1n; // tie: round to even
  }
  let s = digits.toString();
  if (n > 0) {
    s = s.padStart(n + 1, '0');
    s = s.slice(0, -n) + '.' + s.slice(-n);
  }
  const value = Number(s);
  return negative ? -value : value;
}

// re.search(pattern, text): first match or null
function search(re: RegExp, text: string): RegExpExecArray | null {
  return new RegExp(re.source, re.flags.replace('g', '')).exec(text);
}

// re.finditer(pattern, text): every match, left to right
function findAll(re: RegExp, text: string): RegExpExecArray[] {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  return [...text.matchAll(new RegExp(re.source, flags))] as RegExpExecArray[];
}

// m.group(i): Python gives None for a group that took no part in the match
function group(m: RegExpExecArray, i: number): string | null {
  return m[i] ?? null;
}

// Python's float('3.99') / float('3,99'.replace(',', '.'))
function toFloat(s: string): number {
  return Number(s.replace(',', '.'));
}

// Python's str.isdigit() for the characters that appear on labels
function isDigits(s: string): boolean {
  return /^\d+$/.test(s);
}

// ---------------------------------------------------------------
// Patterns (copied from Cell 5; comments are the notebook's own)
// ---------------------------------------------------------------

const UNITS = '(kgm|kg|grm|g|litres?|ltre|ltr|l|mls?|each|unit|piece)';

const UNIT_PRICE_PATTERN = new RegExp(String.raw`€\s*(\d+[.,]?\d*)\s*(?:per\s+|\/)?\s*` + UNITS + String.raw`\b`, 'i');

const UNIT_PRICE_CENTS_PATTERN = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*c\b\s*(?:per\s+|\/)?\s*` + UNITS, 'i');

const UNIT_PRICE_EQUALS_PATTERN = new RegExp(String.raw`1\s*` + UNITS + String.raw`\s*=\s*€?\s*(\d+[.,]\d{2})`, 'i');

// Fallback: slash-anchored unit price where € was misread as a digit/letter
// "616.06/KGM" -> € read as 6 -> 16.06; "611.0fLTR" -> / read as f (F2)
const UNIT_PRICE_SLASH_PATTERN = new RegExp(String.raw`[€E6C0]?(\d{1,3}[.,]\d{1,2})\s*[\/f]\s*` + UNITS, 'i');

// Fallback: "per"-anchored, tolerating a lost/misread € (F3)
const UNIT_PRICE_PER_PATTERN = new RegExp(String.raw`[€E6C0]?(\d{1,3}(?:[.,]\d{1,2})?)\s*per\s+` + UNITS + String.raw`\b`, 'i');

const UNIT_CANONICAL: Record<string, string> = {
  kgm: 'kg', kg: 'kg',
  grm: 'g', g: 'g',
  ltre: 'l', ltr: 'l', l: 'l', litre: 'l', litres: 'l',
  ml: 'ml', mls: 'ml',
  each: 'unit', unit: 'unit', piece: 'unit',
};

// Deal pattern: "2 for 5", "2 for €5.00", "3 for 10.00", "3 for 2"
const DEAL_PATTERN = /(\d+)\s*for\s*€?\s*(\d+(?:\.\d{1,2})?)(?![a-zA-Z0-9])/i;

const CLUBCARD_KEYWORDS = ['clubcard', 'club card', 'lidl plus', 'rewards'];

// (?!\.\d) rejects date-shaped numbers: "22.07.26" never matches (F1)
const PRICE_PATTERN = /€?\s*(?<![\d.])(\d{1,3}\.\d{2})\b(?!\.\d)/;

const CENTS_PRICE_PATTERN = /(?<![\d.,])(\d{1,2})\s*c\b/;

const WHOLE_EURO_PATTERN = /€\s*(\d{1,4})\b(?!\s*[.,])/;

// Deposit: "€0.25 deposit", "deposit 25c", "DRS €0.25", "+0.25 DRS Deposit"
const DEPOSIT_PATTERN = new RegExp(
  String.raw`(?:deposit|drs)\D{0,15}?(?:€\s*(\d+\.\d{2})|(\d{1,2})\s*c\b)` +
  String.raw`|(?:€?\s*(\d+\.\d{2})|(\d{1,2})\s*c\b)\s*(?:drs\s+)?(?:deposit|drs)`,
  'i',
);

const MULTIPACK_PATTERN = /(?<!€)\b(\d{1,2}\s*x\s*\d+(?:[.,]\d+)?\s*(?:kgs?|grms?|gms?|g|mls?|cls?|ltrs?|l|m)?)\b/i;

// Weight/volume: "500g", "1.5L", "330ml", "6 pack" — NOT preceded by € (F8: packs?)
const WEIGHT_PATTERN = /(?<!€)(?<!€ )\b(\d+(?:[.,]\d+)?)\s*(kgs?|grms?|gms?|g|mls?|cls?|ltrs?|l|packs?)\b/i;

// Distinguish price deals ("3 for 10.00") from qty deals ("3 for 2")
function classifyDeal(qtyStr: string, valueStr: string): ['price' | 'qty', number, number] {
  const qty = parseInt(qtyStr, 10);
  if (!valueStr.includes('.') && parseInt(valueStr, 10) < qty) {
    return ['qty', qty, Number(valueStr)]; // "3 for 2" -> deal_price 2.0
  }
  return ['price', qty, Number(valueStr)];
}

// ---------------------------------------------------------------
// The parser
// ---------------------------------------------------------------

export function extractFromOcr(ocrResult: OcrPiece[]): ParsedLabel {
  const output = createEmptyOutput();

  // Text pieces with bbox heights (font-size proxy) and positions
  const pieces: Piece[] = ocrResult.map(([bbox, text]) => {
    const xs = bbox.map((pt) => pt[0]);
    const ys = bbox.map((pt) => pt[1]);
    return {
      text,
      height: Math.max(...ys) - Math.min(...ys),
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      w: Math.max(...xs) - Math.min(...xs),
    };
  });

  const fullText = pieces.map((p) => p.text).join(' ');
  const fullLower = fullText.toLowerCase();

  // ----- 1. Unit price (first, so we can exclude it later) -----
  // Prefer weight/volume units (kg/g/l/ml) over each/unit; each/unit
  // only accepted with an explicit "per" ("€53 each" is a price, F4)
  let bestEach: [number, string] | null = null;
  let foundWeightUnit = false;
  for (const m of findAll(UNIT_PRICE_PATTERN, fullText)) {
    const u = UNIT_CANONICAL[m[2].toLowerCase()];
    const v = toFloat(m[1]);
    if (u !== 'unit') {
      output.unit_price = v;
      output.unit = u;
      foundWeightUnit = true;
      break;
    }
    if (bestEach === null && m[0].toLowerCase().includes('per')) {
      bestEach = [v, u];
    }
  }
  if (!foundWeightUnit && bestEach) {
    [output.unit_price, output.unit] = bestEach;
  }

  if (output.unit_price === null) {
    let m = search(UNIT_PRICE_CENTS_PATTERN, fullText);
    if (m) {
      output.unit_price = pyRound(Number(m[1]) / 100, 3); // 32.3c -> 0.323
      output.unit = UNIT_CANONICAL[m[2].toLowerCase()];
    } else {
      m = search(UNIT_PRICE_EQUALS_PATTERN, fullText);
      if (m) {
        // note: equals pattern group order is (unit, price) — reversed
        output.unit_price = toFloat(m[2]);
        output.unit = UNIT_CANONICAL[m[1].toLowerCase()];
      } else {
        m = search(UNIT_PRICE_SLASH_PATTERN, fullText);
        if (m) {
          output.unit_price = toFloat(m[1]);
          output.unit = UNIT_CANONICAL[m[2].toLowerCase()];
        } else {
          m = search(UNIT_PRICE_PER_PATTERN, fullText);
          if (m) {
            output.unit_price = toFloat(m[1]);
            output.unit = UNIT_CANONICAL[m[2].toLowerCase()];
          }
        }
      }
    }
  }

  // ----- 2. Deals -----
  const dealMatch = search(DEAL_PATTERN, fullLower);
  if (dealMatch) {
    const [dealType, dealQty, dealPrice] = classifyDeal(dealMatch[1], dealMatch[2]);
    output.deal_type = dealType;
    output.deal_qty = dealQty;
    output.deal_price = dealPrice;
  }

  // ----- 2b. Deal fallback: vertical "N / for / €X.XX" stack -----
  if (output.deal_type === null) {
    for (const f of pieces) {
      const am = /^(?:(\d{1,2})\s*)?for$/i.exec(f.text.trim());
      if (!am) continue;
      const col = (p: Piece) => Math.abs(p.cx - f.cx) < Math.max(p.w, f.w);
      let qty = group(am, 1);
      if (qty === null) {
        const above = pieces.filter((p) => /^\d{1,2}$/.test(p.text.trim()) && p.cy < f.cy && col(p));
        if (above.length === 0) continue;
        qty = minBy(above, (p) => f.cy - p.cy).text.trim();
      }
      const below: [Piece, number][] = [];
      for (const p of pieces) {
        if (p.cy <= f.cy || !col(p)) continue;
        const pm = /(\d{1,3}\.\d{2})/.exec(p.text);
        if (pm) {
          below.push([p, Number(pm[1])]);
        } else if (/^\d{3}$/.test(p.text.trim())) {
          // OCR dropped the decimal: "135" -> 1.35 (deal prices are never €100+)
          below.push([p, parseInt(p.text.trim(), 10) / 100]);
        }
      }
      if (below.length > 0) {
        const [, priceVal] = minBy(below, (t) => t[0].cy - f.cy);
        const [dt, dq, dp] = classifyDeal(qty, priceVal.toFixed(2));
        output.deal_type = dt;
        output.deal_qty = dq;
        output.deal_price = dp;
        break;
      }
    }
  }

  // ----- 3. Deposit price (before clubcard: F5) -----
  const dm = search(DEPOSIT_PATTERN, fullLower);
  if (dm) {
    const euro = group(dm, 1) ?? group(dm, 3);
    const cents = group(dm, 2) ?? group(dm, 4);
    if (euro) {
      output.deposit_price = Number(euro);
    } else if (cents) {
      output.deposit_price = pyRound(parseInt(cents, 10) / 100, 2); // "25c" -> 0.25
    }
  }

  // ----- 4. Clubcard price -----
  const piecePrice = (p: Piece): number | null => {
    const pm = search(PRICE_PATTERN, p.text);
    if (pm) return Number(pm[1]);
    const cm = search(CENTS_PRICE_PATTERN, p.text);
    if (cm) return pyRound(parseInt(cm[1], 10) / 100, 2);
    const wm = search(WHOLE_EURO_PATTERN, p.text);
    if (wm) return Number(wm[1]); // "€53" -> 53.0
    if (/^\d{3}$/.test(p.text.trim())) return parseInt(p.text.trim(), 10) / 100; // Lidl font: "099" -> 0.99
    return null;
  };
  const hasKeyword = (lower: string) => CLUBCARD_KEYWORDS.some((kw) => lower.includes(kw));
  const dist = (p: Piece, q: Piece) => ((p.cx - q.cx) ** 2 + (p.cy - q.cy) ** 2) ** 0.5;

  for (const kwPiece of pieces) {
    const pl = kwPiece.text.toLowerCase();
    if (!hasKeyword(pl)) continue;
    output.has_clubcard_price = true;
    if (pl.includes('without')) continue;

    // Price in the keyword piece itself ("Clubcard Price €1.50" merged)?
    const own = piecePrice(kwPiece);
    if (own !== null) {
      output.clubcard_price = own;
      break;
    }

    // Otherwise: nearest price piece in the same column as the keyword,
    // skipping unit-price lines ("1 piece = 0.29", F6) and already-
    // extracted deal/deposit amounts (F5)
    const col = (p: Piece) => Math.abs(p.cx - kwPiece.cx) < Math.max(p.w, kwPiece.w);
    const candidates: [number, number][] = [];
    const withoutPieces = pieces.filter((p) => p.text.toLowerCase().includes('without') && hasKeyword(p.text.toLowerCase()));
    const eqRows = pieces.filter((q) => q.text.includes('='));
    for (const p of pieces) {
      if (
        p === kwPiece || !col(p) || p.text.includes('=') ||
        eqRows.some((q) => Math.abs(p.cy - q.cy) < Math.max(p.height, q.height) / 2)
      ) continue;
      const val = piecePrice(p);
      if (val === null || val === output.deal_price || val === output.deposit_price || val === output.unit_price) continue;
      const dKw = dist(p, kwPiece);
      if (withoutPieces.length > 0 && Math.min(...withoutPieces.map((w) => dist(p, w))) < dKw) {
        continue; // this price belongs to the "Without" panel
      }
      candidates.push([dKw, val]);
    }
    if (candidates.length > 0) {
      // Python min() on (distance, value) pairs: nearest first, then lowest value
      output.clubcard_price = candidates.reduce((best, c) =>
        c[0] < best[0] || (c[0] === best[0] && c[1] < best[1]) ? c : best,
      )[1];
    }
    break;
  }

  // ----- 5. Weight/volume -----
  // Per piece, skipping unit-price lines ("1KG = 10.42") and bare
  // quantity-one prefixes from split unit-price lines ("1 L", F6)
  for (const p of pieces) {
    if (p.text.includes('=')) continue;
    if (/^1\s*(kgm|kg|ltre|ltr|l|litre)\s*[-=]/i.test(p.text.trim())) continue;
    const mm = search(MULTIPACK_PATTERN, p.text);
    if (mm) {
      output.weight_volume = mm[1].toLowerCase().replace(/ /g, '');
      break;
    }
    const wm = search(WEIGHT_PATTERN, p.text);
    if (wm) {
      output.weight_volume = `${wm[1]}${wm[2].toLowerCase()}`;
      break;
    }
  }

  // ----- 6. Item text (naive): all non-price text joined -----
  const textPieces = pieces
    .filter((p) => !search(PRICE_PATTERN, p.text) && !isDigits(p.text.trim()))
    .map((p) => p.text);
  if (textPieces.length > 0) {
    output.item_name = textPieces.join(' ');
  }

  // ----- 7. Standard price -----
  const exclude = [output.unit_price, output.clubcard_price, output.deal_price, output.deposit_price];

  // F7: SAVE/Total guard by row geometry — a price on the same visual
  // row as a SAVE/Total label is a savings amount or total, not the price
  const guardRows = pieces.filter((g) => /\bsave\b|\btotal\b/i.test(g.text));
  const rowGuarded = (p: Piece) =>
    guardRows.some((g) => Math.abs(p.cy - g.cy) < Math.max(p.height, g.height) / 2);

  const priceCandidates: { value: number; height: number }[] = [];
  for (const p of pieces) {
    const pl = p.text.toLowerCase();
    if (pl.includes('save') || pl.includes('total') || rowGuarded(p)) continue;
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
    // Main price is normally the biggest text on the label.
    // sort() keeps equal heights in their original order, as Python does.
    priceCandidates.sort((a, b) => b.height - a.height);
    output.standard_price = priceCandidates[0].value;
  }

  return output;
}

// Python's min(items, key=...): the first item with the smallest key
function minBy<T>(items: T[], key: (item: T) => number): T {
  let best = items[0];
  let bestKey = key(best);
  for (const item of items.slice(1)) {
    const k = key(item);
    if (k < bestKey) {
      best = item;
      bestKey = k;
    }
  }
  return best;
}
