// HTTP server (T6) — zero-dependency Node built-in http. Serves the API and the
// static vanilla frontend so `node src/server.js` runs the whole demo with no install.
// M2 note: ports to Express per PLAN.md D2.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getRoutes } from './routeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(__dirname, '..', 'web');
const PORT = process.env.PORT || 5050;
const CHAINS = ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'bsc'];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');

  // --- API: GET /api/routes?from&to&token&amount ---
  if (url.pathname === '/api/routes') {
    try {
      const q = parseQuery(url.searchParams);
      const result = await getRoutes(q);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: String(err.message || err) });
    }
  }

  // --- static frontend ---
  if (req.method === 'GET') {
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    try {
      const body = await readFile(path.join(WEB_DIR, file));
      res.setHeader('Content-Type', contentType(file));
      res.writeHead(200);
      return res.end(body);
    } catch {
      res.writeHead(404);
      return res.end('Not found');
    }
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

function parseQuery(p) {
  const fromChain = p.get('from');
  const toChain = p.get('to');
  const token = p.get('token') || 'USDC';
  const amount = Number(p.get('amount'));
  if (!CHAINS.includes(fromChain)) throw new Error(`bad 'from' chain: ${fromChain}`);
  if (!CHAINS.includes(toChain)) throw new Error(`bad 'to' chain: ${toChain}`);
  if (fromChain === toChain) throw new Error('from and to chains must differ');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`bad 'amount': ${p.get('amount')}`);
  return { fromChain, toChain, token, amount };
}

function json(res, code, obj) {
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(code);
  res.end(JSON.stringify(obj, null, 2));
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html';
  if (file.endsWith('.js')) return 'text/javascript';
  if (file.endsWith('.css')) return 'text/css';
  return 'text/plain';
}

server.listen(PORT, () => {
  console.log(`bridge-cost-optimizer running → http://localhost:${PORT}  (ADAPTER=${process.env.ADAPTER || 'mock'})`);
});
