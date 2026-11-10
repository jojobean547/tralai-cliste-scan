// Product barcodes (EAN-13, EAN-8, UPC-A) end in a check digit worked out from
// the other digits, so a mistyped or misread barcode can almost always be caught.

export function isValidBarcode(text: string): boolean {
  const digits = text.trim();
  if (!/^\d+$/.test(digits) || ![8, 12, 13].includes(digits.length)) return false;
  // Pad UPC-A (12) to EAN-13; EAN-8 uses the same weights counted from the right
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const fromRight = body.length - 1 - i;
    sum += Number(body[i]) * (fromRight % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

// Some labels print an 8-digit barcode padded to 13 digits, e.g.
// 0000020106331 is really 20106331. The padding doesn't change the check digit.
export function normaliseBarcode(digits: string): string {
  if (digits.length === 13 && digits.startsWith('00000')) return digits.slice(5);
  return digits;
}

// GS1 (the barcode body) keeps some number ranges aside that are never given
// to a company. Shops use them for their own codes, so the same number can mean
// different products in different shops ("restricted circulation numbers"):
//   8 digits starting with 0 or 2   – one company's own code
//   13 digits starting with 02 or 2 – regional codes, often weighed items
//   13 digits starting with 04      – one company's own code
// Everything else is a normal product barcode, the same worldwide.
export type BarcodeKind = 'product' | 'storeCode';

export function barcodeKind(code: string): BarcodeKind {
  if (code.length === 8 && (code.startsWith('0') || code.startsWith('2'))) return 'storeCode';
  if (code.length === 13 && (code.startsWith('2') || code.startsWith('02') || code.startsWith('04'))) return 'storeCode';
  return 'product';
}
