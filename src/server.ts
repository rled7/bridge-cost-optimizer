// HTTP server (T6) — Express + CORS. Serves GET /api/routes.
// M2 port from the plain Node http server in server.js.

import express from 'express';
import cors from 'cors';
import { getRoutes } from './routeService.js';
import type { Chain, RouteQuery } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 5050;
const CHAINS: Chain[] = ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'bsc'];

function isChain(s: unknown): s is Chain {
  return typeof s === 'string' && (CHAINS as string[]).includes(s);
}

app.get('/api/routes', async (req, res) => {
  try {
    const { from, to, token, amount } = req.query as Record<string, string>;

    if (!isChain(from)) {
      res.status(400).json({ error: `bad 'from' chain: ${from}` });
      return;
    }
    if (!isChain(to)) {
      res.status(400).json({ error: `bad 'to' chain: ${to}` });
      return;
    }
    if (from === to) {
      res.status(400).json({ error: 'from and to chains must differ' });
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      res.status(400).json({ error: `bad 'amount': ${amount}` });
      return;
    }

    const q: RouteQuery = {
      fromChain: from,
      toChain: to,
      token: token || 'USDC',
      amount: amt,
    };

    const result = await getRoutes(q);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(
    `bridge-cost-optimizer running → http://localhost:${PORT}  (ADAPTER=${process.env.ADAPTER || 'mock'})`
  );
});
