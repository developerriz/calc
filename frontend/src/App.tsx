import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ApiError, calculate, clearHistory, fetchHistory, type Entry } from './lib/api';
import { evaluate } from './lib/evaluate';
import { append, fmt } from './lib/input';

type Kind = 'digit' | 'fn' | 'op' | 'eq';
type KeyDef = { v: string; label: string; kind: Kind };

const d = (n: string): KeyDef => ({ v: n, label: n, kind: 'digit' });
const KEYS: KeyDef[] = [
  { v: 'AC', label: 'AC', kind: 'fn' }, { v: 'DEL', label: '⌫', kind: 'fn' },
  { v: '%', label: '%', kind: 'fn' }, { v: '÷', label: '÷', kind: 'op' },
  d('7'), d('8'), d('9'), { v: '×', label: '×', kind: 'op' },
  d('4'), d('5'), d('6'), { v: '−', label: '−', kind: 'op' },
  d('1'), d('2'), d('3'), { v: '+', label: '+', kind: 'op' },
  { v: '()', label: '( )', kind: 'fn' }, d('0'), d('.'), { v: '=', label: '=', kind: 'eq' },
];

const KIND_STYLE: Record<Kind, string> = {
  digit: 'bg-white/[0.07] text-ice hover:bg-white/[0.12]',
  fn: 'bg-white/[0.14] text-ice hover:bg-white/[0.2]',
  op: 'bg-peach/15 text-peach hover:bg-peach/25',
  eq: 'bg-volt text-white shadow-[0_10px_32px_-8px_rgba(124,92,255,0.8)] hover:brightness-110',
};

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [expr, setExpr] = useState('');
  const [sub, setSub] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [settleKey, setSettleKey] = useState(0);
  const [errorKey, setErrorKey] = useState(0);

  const fresh = useRef(false); // true right after "=", so the next digit starts a new calculation
  const busy = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const bigRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Live preview while typing, e.g. "12×3+4" shows "= 40"
  const preview = useMemo(() => {
    if (!/[+−×÷%]/.test(expr.replace(/^−/, ''))) return '';
    try { return '= ' + fmt(evaluate(expr)); } catch { return ''; }
  }, [expr]);

  // One orchestrated entrance: card rises, keys build in from the "=" key backwards.
  useLayoutEffect(() => {
    if (reduced()) return;
    const ctx = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from(cardRef.current, { y: 32, opacity: 0, scale: 0.96, duration: 0.9 })
        .from('[data-key]', { y: 18, opacity: 0, scale: 0.85, duration: 0.6, stagger: { each: 0.03, from: 'end' } }, '-=0.55');
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Result settles in with a soft blur-to-sharp.
  useEffect(() => {
    if (!settleKey || reduced()) return;
    gsap.fromTo(bigRef.current, { yPercent: 40, opacity: 0, filter: 'blur(8px)' },
      { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.55, ease: 'expo.out' });
  }, [settleKey]);

  // Errors shake the display.
  useEffect(() => {
    if (!errorKey || reduced()) return;
    gsap.fromTo(displayRef.current, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.25)' });
  }, [errorKey]);

  useEffect(() => {
    fetchHistory().then(setHistory).catch(() => setOnline(false));
  }, []);

  const pulse = useCallback((v: string) => {
    if (reduced()) return;
    const el = gridRef.current?.querySelector(`[data-key="${CSS.escape(v)}"]`);
    if (el) gsap.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.55, ease: 'elastic.out(1, 0.45)', overwrite: true });
  }, []);

  const submit = useCallback(async () => {
    if (!expr || busy.current) return;
    busy.current = true;
    try {
      let entry: Entry;
      try {
        entry = await calculate(expr);
        setOnline(true);
      } catch (e) {
        if (e instanceof ApiError) throw e;
        // Backend is down: calculate locally so the app still works.
        entry = { id: crypto.randomUUID(), expression: expr, result: evaluate(expr), at: new Date().toISOString() };
        setOnline(false);
      }
      setHistory((h) => [entry, ...h].slice(0, 50));
      setSub(`${expr} =`);
      setExpr(fmt(entry.result));
      fresh.current = true;
      setSettleKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setErrorKey((k) => k + 1);
    } finally {
      busy.current = false;
    }
  }, [expr]);

  const press = useCallback((v: string) => {
    pulse(v);
    if (v === '=') { void submit(); return; }
    setError(null);
    if (v === 'AC') { setExpr(''); setSub(''); fresh.current = false; return; }
    if (v === 'DEL') {
      if (fresh.current) { setExpr(''); setSub(''); fresh.current = false; } else setExpr(expr.slice(0, -1));
      return;
    }
    if (expr.length >= 28 && !fresh.current) return;
    setExpr(append(expr, v, fresh.current));
    setSub('');
    fresh.current = false;
  }, [expr, pulse, submit]);

  useEffect(() => {
    const MAP: Record<string, string> = {
      '+': '+', '-': '−', '*': '×', '/': '÷', '%': '%', '.': '.', '(': '()', ')': '()',
      Enter: '=', '=': '=', Backspace: 'DEL', Escape: 'AC',
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (open) { if (e.key === 'Escape') setOpen(false); return; }
      const v = /^[0-9]$/.test(e.key) ? e.key : MAP[e.key];
      if (!v) return;
      e.preventDefault();
      press(v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, open]);

  const onClear = async () => {
    try { await clearHistory(); setOnline(true); } catch { setOnline(false); }
    setHistory([]);
  };

  const size = expr.length <= 8 ? 64 : expr.length <= 11 ? 52 : expr.length <= 15 ? 40 : 30;

  return (
    <div ref={rootRef} className="grid min-h-screen place-items-center p-4">
      <div
        ref={cardRef}
        className="relative w-full max-w-[380px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-ice/60" title={online ? 'Connected to the backend' : 'Backend not reachable'}>
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-peach'}`} />
            {online ? 'Synced with server' : 'Offline, calculating locally'}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-xs text-ice outline-none transition-colors hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-ice/70"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>
            History
          </button>
        </div>

        <div ref={displayRef} className="mt-6 mb-5 min-h-[132px] text-right" aria-live="polite">
          <div className={`h-6 truncate text-sm tabular-nums ${error ? 'text-[#ff8a8a]' : 'text-ice/50'}`}>{error ?? (sub || preview)}</div>
          <div className="mt-2 flex h-[76px] items-end justify-end overflow-hidden">
            <div
              ref={bigRef}
              className="whitespace-nowrap font-light leading-none tabular-nums transition-[font-size] duration-200"
              style={{ fontSize: size }}
            >
              {expr || '0'}
            </div>
          </div>
        </div>

        <div ref={gridRef} className="grid grid-cols-4 gap-3">
          {KEYS.map((k) => (
            <button
              key={k.v}
              data-key={k.v}
              onClick={() => press(k.v)}
              aria-label={k.v === 'DEL' ? 'Delete' : k.v === 'AC' ? 'All clear' : k.v === '()' ? 'Brackets' : k.label}
              className={`h-16 select-none rounded-2xl text-2xl font-light outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ice/70 ${KIND_STYLE[k.kind]}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* History drawer: slides up in response to the History button */}
        <div
          aria-hidden={!open}
          className="absolute inset-0 z-10 flex flex-col rounded-[2rem] bg-[#0e1430]/95 p-5 backdrop-blur-2xl"
          style={{
            transform: open ? 'translateY(0)' : 'translateY(105%)',
            visibility: open ? 'visible' : 'hidden',
            transition: `transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s linear ${open ? '0s' : '0.5s'}`,
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">History</h2>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs outline-none hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-ice/70"
            >
              Close
            </button>
          </div>
          <ul className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
            {history.length === 0 && (
              <li className="pt-10 text-center text-sm text-ice/50">No calculations yet. Press = to save one here.</li>
            )}
            {history.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => { setExpr(fmt(h.result)); setSub(`${h.expression} =`); fresh.current = true; setError(null); setOpen(false); }}
                  className="w-full rounded-2xl bg-white/[0.06] px-4 py-3 text-right outline-none transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-ice/70"
                >
                  <div className="truncate text-xs tabular-nums text-ice/50">{h.expression}</div>
                  <div className="text-xl font-light tabular-nums">{fmt(h.result)}</div>
                </button>
              </li>
            ))}
          </ul>
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="mt-3 rounded-2xl bg-peach/15 py-3 text-sm text-peach outline-none hover:bg-peach/25 focus-visible:ring-2 focus-visible:ring-ice/70"
            >
              Clear history
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
