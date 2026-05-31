import React, { useState, FormEvent } from 'react';

// ---- Types (mirrors backend RouteQuote) ----

type Chain = 'ethereum' | 'arbitrum' | 'optimism' | 'base' | 'polygon' | 'bsc';

interface FeeBreakdown {
  sourceGasUsd: number;
  destGasUsd: number;
  protocolFeeUsd: number;
}

interface RouteQuote {
  bridge: string;
  amountInUsd: number;
  amountOutUsd: number;
  amountOutToken: number;
  fees: FeeBreakdown;
  totalCostUsd: number;
  effectiveCostBps: number;
  etaSeconds: number;
  flagged: boolean;
}

interface RoutesResult {
  query: { fromChain: Chain; toChain: Chain; token: string; amount: number };
  routes: RouteQuote[];
  count: number;
}

// ---- Helpers ----

const CHAINS: Chain[] = ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon', 'bsc'];

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5050';

function fmt(n: number): string {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtEta(s: number): string {
  return s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`;
}

// ---- Styles (inline objects) ----

const styles = {
  wrap: {
    maxWidth: 920,
    margin: '0 auto',
    padding: '32px 20px',
  } as React.CSSProperties,
  h1: {
    fontSize: 22,
    margin: '0 0 4px',
  } as React.CSSProperties,
  sub: {
    color: '#8b949e',
    margin: '0 0 24px',
  } as React.CSSProperties,
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 10,
    alignItems: 'end',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: 12,
    color: '#8b949e',
    marginBottom: 4,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px',
    borderRadius: 6,
    border: '1px solid #30363d',
    background: '#161b22',
    color: '#e6edf3',
    font: 'inherit',
  } as React.CSSProperties,
  button: {
    width: '100%',
    padding: '8px',
    borderRadius: 6,
    border: '1px solid #238636',
    background: '#238636',
    color: '#e6edf3',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: 24,
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '10px 8px',
    borderBottom: '1px solid #21262d',
    color: '#8b949e',
    fontSize: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  td: {
    textAlign: 'left' as const,
    padding: '10px 8px',
    borderBottom: '1px solid #21262d',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,
  tdBest: {
    textAlign: 'left' as const,
    padding: '10px 8px',
    borderBottom: '1px solid #21262d',
    fontVariantNumeric: 'tabular-nums',
    color: '#3fb950',
    fontWeight: 700,
  } as React.CSSProperties,
  flagBadge: {
    background: '#da3633',
    color: '#fff',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 11,
    marginLeft: 6,
  } as React.CSSProperties,
  fees: {
    color: '#8b949e',
    fontSize: 12,
  } as React.CSSProperties,
  meta: {
    color: '#8b949e',
    fontSize: 12,
    marginTop: 8,
  } as React.CSSProperties,
  error: {
    color: '#f85149',
    marginTop: 16,
  } as React.CSSProperties,
  loading: {
    color: '#8b949e',
    marginTop: 16,
  } as React.CSSProperties,
};

// ---- Component ----

export default function App() {
  const [fromChain, setFromChain] = useState<Chain>('ethereum');
  const [toChain, setToChain] = useState<Chain>('arbitrum');
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RoutesResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        from: fromChain,
        to: toChain,
        token,
        amount,
      });
      const res = await fetch(`${API_BASE}/api/routes?${params}`);
      const data = (await res.json()) as RoutesResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setResult(data as RoutesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.h1}>Cross-Chain Bridge Cost Optimizer</h1>
      <p style={styles.sub}>
        Ranks routes by <strong>net capital preserved</strong> after source gas + destination gas +
        protocol fee. Flags unreasonable fees (QA).
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div>
          <label style={styles.label}>From</label>
          <select
            style={styles.input}
            value={fromChain}
            onChange={(e) => setFromChain(e.target.value as Chain)}
          >
            {CHAINS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={styles.label}>To</label>
          <select
            style={styles.input}
            value={toChain}
            onChange={(e) => setToChain(e.target.value as Chain)}
          >
            {CHAINS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={styles.label}>Token</label>
          <input
            style={styles.input}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div>
          <label style={styles.label}>Amount</label>
          <input
            style={styles.input}
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <button type="submit" style={styles.button}>
            Find routes
          </button>
        </div>
      </form>

      {loading && <p style={styles.loading}>Loading…</p>}

      {error && <p style={styles.error}>{error}</p>}

      {result && (
        <>
          <p style={styles.meta}>
            {result.count} routes · amount in {fmt(result.routes[0]?.amountInUsd ?? 0)}
          </p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Bridge</th>
                <th style={styles.th}>Net received</th>
                <th style={styles.th}>Cost breakdown (3 layers)</th>
                <th style={styles.th}>Eff. cost</th>
                <th style={styles.th}>ETA</th>
              </tr>
            </thead>
            <tbody>
              {result.routes.map((r, i) => (
                <tr key={r.bridge}>
                  <td style={styles.td}>
                    {r.bridge}
                    {r.flagged && <span style={styles.flagBadge}>unreasonable fee</span>}
                  </td>
                  <td style={i === 0 ? styles.tdBest : styles.td}>
                    {fmt(r.amountOutUsd)}
                    {i === 0 ? ' ⭐' : ''}
                  </td>
                  <td style={{ ...styles.td, ...styles.fees }}>
                    src {fmt(r.fees.sourceGasUsd)} · dst {fmt(r.fees.destGasUsd)} · fee{' '}
                    {fmt(r.fees.protocolFeeUsd)}
                  </td>
                  <td style={styles.td}>{(r.effectiveCostBps / 100).toFixed(3)}%</td>
                  <td style={styles.td}>{fmtEta(r.etaSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
