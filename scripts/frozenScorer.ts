// The capstone's frozen scorer, ported from Cell 9 of the notebook:
// normalise(), field_match() and tokenise(). Do not change these:
// every parser version must be scored the same way.

import { pyRound } from '../lib/labelParser/extractFromOcr';

type Value = string | number | boolean | null | undefined;

// Python's normalise(value, field)
export function normalise(value: Value, field: string): string | number | boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isNaN(value)) return null;

  if (field === 'has_clubcard_price') {
    if (typeof value === 'string') return value.trim().toUpperCase() === 'TRUE';
    return Boolean(value);
  }
  if (['standard_price', 'clubcard_price', 'deal_price', 'deposit_price'].includes(field)) {
    const n = Number(value);
    return Number.isNaN(n) ? String(value).trim() : pyRound(n, 2);
  }
  if (field === 'unit_price') {
    const n = Number(value);
    return Number.isNaN(n) ? String(value).trim() : pyRound(n, 3);
  }
  if (field === 'deal_qty') return Math.trunc(Number(value));
  if (field === 'deal_type' || field === 'unit') {
    let s = String(value).trim().toLowerCase();
    if (field === 'unit') s = s.replace(/per /g, '').replace(/each/g, 'unit').trim();
    return s;
  }
  if (field === 'weight_volume') {
    const s = String(value).toLowerCase().replace(/ /g, '').replace(/,/g, '.').trim();
    return s.replace(/s+$/, '');
  }
  return value;
}

// Python's tokenise(text): lowercase words and numbers
export function tokenise(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

// Python's field_match(gt_row, res_row, field) -> matched?
export function fieldMatch(
  gt: Record<string, string>,
  res: Record<string, Value>,
  field: string,
): boolean {
  if (field === 'item_text') {
    const gtText = [gt.brand, gt.item_name].filter((v) => v).join(' ');
    const resText = [res.brand, res.item_name].filter((v) => v).join(' ');
    const gtTokens = tokenise(gtText);
    if (gtTokens.size === 0) return true; // nothing to find
    const resTokens = tokenise(resText);
    let hits = 0;
    for (const t of gtTokens) if (resTokens.has(t)) hits++;
    return hits / gtTokens.size >= 0.5;
  }
  return normalise(gt[field], field) === normalise(res[field], field);
}
