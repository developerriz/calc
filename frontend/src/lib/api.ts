export type Entry = { id: string; expression: string; result: number; at: string };

/** A 4xx from the server: the expression itself is the problem, so show the message. */
export class ApiError extends Error {}

export async function calculate(expression: string): Promise<Entry> {
  const res = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expression }),
  });
  if (res.status >= 500) throw new Error('Backend unreachable'); // dev proxy returns 5xx when it is down
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Calculation failed');
  return data as Entry;
}

export async function fetchHistory(): Promise<Entry[]> {
  const res = await fetch('/api/history');
  if (!res.ok) throw new Error('Backend unreachable');
  return res.json();
}

export async function clearHistory(): Promise<void> {
  const res = await fetch('/api/history', { method: 'DELETE' });
  if (!res.ok) throw new Error('Backend unreachable');
}
