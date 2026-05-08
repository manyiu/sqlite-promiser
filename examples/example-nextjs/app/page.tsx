import { DbDemo } from './DbDemo';

export default function Page() {
  return (
    <main>
      <h1>sqlite-promiser (Next.js example)</h1>
      <p>
        This page renders a client component which opens SQLite in a worker and prefers OPFS when cross-origin
        isolation is enabled.
      </p>
      <DbDemo />
    </main>
  );
}

