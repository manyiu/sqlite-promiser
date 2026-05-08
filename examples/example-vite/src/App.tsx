import { useEffect, useMemo, useState } from 'react';
import { createDatabase, describeEnvironment } from 'sqlite-promiser';
import type { Database } from 'sqlite-promiser';

export default function App() {
  const dbName = useMemo(() => `vite-demo`, []);
  const [db, setDb] = useState<Database | undefined>(undefined);
  const [status, setStatus] = useState<string>('Initializing…');
  const [rows, setRows] = useState<Array<{ id: number; v: string }>>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    (window as unknown as { __sqliteSmoke?: () => Promise<unknown> }).__sqliteSmoke = async () => {
      const db = await createDatabase({ name: `e2e-${Date.now()}`, preferOpfs: true });
      const diag = db.getDiagnostics();
      await db.exec(`CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, v TEXT)`);
      await db.exec(`INSERT INTO t (v) VALUES ('hello')`);
      const row = await db.get<{ v: string }>(`SELECT v FROM t WHERE id = 1`);
      await db.close();
      return { row, diag };
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('Opening database…');
    setError(undefined);

    void (async () => {
      try {
        const d = await createDatabase({ name: dbName, preferOpfs: true });
        await d.exec(`CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, v TEXT)`);
        const current = await d.all<{ id: number; v: string }>(`SELECT id, v FROM t ORDER BY id DESC LIMIT 20`);
        if (cancelled) return;
        setDb(d);
        setRows(current);
        const diag = d.getDiagnostics();
        setStatus(`Ready (${diag.mode}${diag.persistent ? ', persistent' : ''}, vfs=${diag.vfs})`);
      } catch (e) {
        if (cancelled) return;
        setError(String(e));
        setStatus('Failed');
      }
    })();

    return () => {
      cancelled = true;
      // fire-and-forget close
      db?.close().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dbName stable
  }, [dbName]);

  const env = describeEnvironment();

  const addRow = async () => {
    if (!db) return;
    setStatus('Inserting…');
    setError(undefined);
    try {
      const value = `row-${new Date().toISOString()}`;
      await db.exec(`INSERT INTO t (v) VALUES (?)`, [value]);
      const current = await db.all<{ id: number; v: string }>(`SELECT id, v FROM t ORDER BY id DESC LIMIT 20`);
      setRows(current);
      setStatus(`Ready (${db.getDiagnostics().mode})`);
    } catch (e) {
      setError(String(e));
      setStatus('Failed');
    }
  };

  const clearAll = async () => {
    if (!db) return;
    setStatus('Clearing…');
    setError(undefined);
    try {
      await db.exec(`DELETE FROM t`);
      const current = await db.all<{ id: number; v: string }>(`SELECT id, v FROM t ORDER BY id DESC LIMIT 20`);
      setRows(current);
      setStatus(`Ready (${db.getDiagnostics().mode})`);
    } catch (e) {
      setError(String(e));
      setStatus('Failed');
    }
  };

  return (
    <main style={{ maxWidth: 820, margin: '32px auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>sqlite-promiser</h1>
      <p style={{ marginTop: 4, opacity: 0.8 }}>Playwright calls <code>window.__sqliteSmoke()</code>.</p>

      <section style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Environment</h2>
        <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(env, null, 2)}</pre>
      </section>

      <section style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Status</h2>
        <p style={{ margin: '8px 0 0' }}>
          <strong>{status}</strong>
          {db ? (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              db=<code>{dbName}</code>
            </span>
          ) : null}
        </p>
        {error ? <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</pre> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => void addRow()} disabled={!db}>
            Insert row
          </button>
          <button onClick={() => void clearAll()} disabled={!db}>
            Clear table
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Rows (latest 20)</h2>
        <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(rows, null, 2)}</pre>
      </section>
    </main>
  );
}
