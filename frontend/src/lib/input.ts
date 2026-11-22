export const OPS = ['+', '−', '×', '÷'];
const ENDS_VALUE = /[0-9)%]/;

/** Pure keypad logic: returns the next expression after pressing `v`. */
export function append(expr: string, v: string, fresh: boolean): string {
  const isDigit = /^[0-9]$/.test(v);
  if (fresh && (isDigit || v === '.' || v === '()' || v === '(')) expr = '';
  const last = expr.slice(-1);

  if (v === '()') {
    const open = (expr.match(/\(/g) ?? []).length;
    const close = (expr.match(/\)/g) ?? []).length;
    if (open > close && ENDS_VALUE.test(last)) return expr + ')';
    return ENDS_VALUE.test(last) ? expr + '×(' : expr + '(';
  }
  if (OPS.includes(v)) {
    if (!expr) return v === '−' ? '−' : '';
    if (last === '(' && v !== '−') return expr;
    if (OPS.includes(last)) return expr.slice(0, -1) + v;
    return expr + v;
  }
  if (v === '%') return /[0-9)]/.test(last) ? expr + '%' : expr;
  if (v === '.') {
    const current = expr.split(/[+−×÷()%]/).pop() ?? '';
    if (current.includes('.')) return expr;
    if (last === ')' || last === '%') return expr + '×0.';
    return expr + (current === '' ? '0.' : '.');
  }
  if (last === ')' || last === '%') return expr + '×' + v;
  return expr + v;
}

export const fmt = (n: number) => String(n).replace('-', '−');
