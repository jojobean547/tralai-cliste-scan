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
