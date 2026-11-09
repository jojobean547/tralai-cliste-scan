// Checks that the TypeScript parser gives exactly the same answers as the
// capstone's Python parser.
//
// Input:    parser-data/p2b_ocr_raw.json     (what PaddleOCR read, per image)
// Expected: parser-data/p2b_results_raw.csv  (what the Python rules produced)
//
// Run from the project folder:   npx tsx scripts/checkPort.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractFromOcr, type OcrPiece, type ParsedLabel } from '../lib/labelParser/extractFromOcr';

const DATA = join(process.cwd(), 'parser-data');

// A small CSV reader that handles "quoted, fields" and "" inside quotes
function readCsv(path: string): Record<string, string>[] {
  const text = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const NUMBER_FIELDS = new Set(['standard_price', 'clubcard_price', 'deal_qty', 'deal_price', 'unit_price', 'deposit_price']);

// Is the TypeScript value the same as what pandas wrote to the CSV?
function same(field: string, expected: string, actual: ParsedLabel[keyof ParsedLabel]): boolean {
  if (expected === '') return actual === null;
  if (field === 'has_clubcard_price') return String(actual === true ? 'True' : 'False') === expected;
  if (NUMBER_FIELDS.has(field)) return actual === Number(expected); // exact, no tolerance
  return actual === expected;
}

const ocr: Record<string, OcrPiece[]> = JSON.parse(readFileSync(join(DATA, 'p2b_ocr_raw.json'), 'utf-8'));
const expectedRows = readCsv(join(DATA, 'p2b_results_raw.csv'));
const fields = Object.keys(expectedRows[0]).filter((f) => f !== 'image_filename' && f !== 'store') as (keyof ParsedLabel)[];

let checked = 0;
const differences: string[] = [];
for (const row of expectedRows) {
  const pieces = ocr[row.image_filename];
  if (!pieces) {
    differences.push(`${row.image_filename}: missing from the JSON`);
    continue;
  }
  const result = extractFromOcr(pieces);
  for (const field of fields) {
    checked++;
    if (!same(field, row[field], result[field])) {
      differences.push(`${row.image_filename}  ${field}\n    Python:     ${JSON.stringify(row[field])}\n    TypeScript: ${JSON.stringify(result[field])}`);
    }
  }
}

console.log(`Labels: ${expectedRows.length}   Fields compared: ${checked}`);
if (differences.length === 0) {
  console.log('✔ The TypeScript parser matches the Python parser on every field.');
} else {
  console.log(`✘ ${differences.length} difference(s):\n`);
  console.log(differences.join('\n'));
  process.exitCode = 1;
}
