import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { evaluate } from './evaluate.js';

type Entry = { id: string; expression: string; result: number; at: string };

const PORT = Number(process.env.PORT ?? 4000);
const MAX_HISTORY = 50;
// In-memory store. Swap this array for a database (Postgres, SQLite, Mongo...) when you need persistence.
const history: Entry[] = [];

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/calculate', (req, res) => {
  const expression: unknown = req.body?.expression;
  if (typeof expression !== 'string' || expression.length === 0 || expression.length > 200) {
    res.status(400).json({ error: 'Send an expression of up to 200 characters.' });
    return;
  }
  try {
    const entry: Entry = {
      id: randomUUID(),
      expression,
      result: evaluate(expression),
      at: new Date().toISOString(),
    };
    history.unshift(entry);
    history.length = Math.min(history.length, MAX_HISTORY);
    res.json(entry);
  } catch (err) {
    res.status(422).json({ error: err instanceof Error ? err.message : 'Calculation failed' });
  }
});

app.get('/api/history', (_req, res) => {
  res.json(history);
});

app.delete('/api/history', (_req, res) => {
  history.length = 0;
  res.status(204).end();
});

app.listen(PORT, () => console.log(`Calculator API running on http://localhost:${PORT}`));
