// Safe expression evaluator (recursive descent). No eval(), no Function().
const NORMALISE: Array<[RegExp, string]> = [
  [/×/g, '*'],
  [/÷/g, '/'],
  [/−/g, '-'],
  [/\s+/g, ''],
];

export function evaluate(input: string): number {
  let s = input;
  for (const [re, to] of NORMALISE) s = s.replace(re, to);
  if (!s) throw new Error('Enter an expression first');
  if (!/^[0-9+\-*/%().]+$/.test(s)) throw new Error('Use only numbers and + − × ÷ % ( )');

  let i = 0;
  const peek = () => s[i];

  function expr(): number {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = s[i++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = unary();
    while (peek() === '*' || peek() === '/') {
      const op = s[i++];
      const r = unary();
      if (op === '/' && r === 0) throw new Error('Cannot divide by zero');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function unary(): number {
    if (peek() === '-') { i++; return -unary(); }
    if (peek() === '+') { i++; return unary(); }
    return postfix();
  }
  function postfix(): number {
    let v = primary();
    while (peek() === '%') { i++; v /= 100; }
    return v;
  }
  function primary(): number {
    if (peek() === '(') {
      i++;
      const v = expr();
      if (peek() !== ')') throw new Error('Close the bracket');
      i++;
      return v;
    }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (!m) throw new Error('Check the operators');
    i += m[0].length;
    return parseFloat(m[0]);
  }

  const value = expr();
  if (i < s.length) throw new Error('Check the brackets and operators');
  if (!Number.isFinite(value)) throw new Error('Result is too large');
  return parseFloat(value.toPrecision(12));
}
