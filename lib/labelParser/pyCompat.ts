// Small helpers that behave like the Python the parser was first written in.
// (extractFromOcr.ts keeps its own copies, so the frozen baseline never changes.)

// Python's round(x, n): rounds the exact stored value, exact halves to the even digit.
export function pyRound(x: number, n: number): number {
  const negative = x < 0;
  const [intPart, frac] = Math.abs(x).toFixed(100).split('.');
  const kept = frac.slice(0, n);
  const rest = frac.slice(n);
  let digits = BigInt(intPart + kept);
  const first = rest[0];
  const restIsExactHalf = first === '5' && /^0*$/.test(rest.slice(1));
  if (first > '5' || (first === '5' && !restIsExactHalf)) digits += 1n;
  else if (restIsExactHalf && digits % 2n === 1n) digits += 1n;
  let s = digits.toString();
  if (n > 0) {
    s = s.padStart(n + 1, '0');
    s = s.slice(0, -n) + '.' + s.slice(-n);
  }
  const value = Number(s);
  return negative ? -value : value;
}

// re.search: first match or null
export function search(re: RegExp, text: string): RegExpExecArray | null {
  return new RegExp(re.source, re.flags.replace('g', '')).exec(text);
}

// re.finditer: every match, left to right
export function findAll(re: RegExp, text: string): RegExpExecArray[] {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  return [...text.matchAll(new RegExp(re.source, flags))] as RegExpExecArray[];
}

// min(items, key=...): the first item with the smallest key
export function minBy<T>(items: T[], key: (item: T) => number): T {
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
