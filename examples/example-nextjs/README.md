# example-nextjs

Minimal Next.js App Router example using `sqlite-promiser`.

## Run

```bash
pnpm install
pnpm --filter example-nextjs dev
```

`dev` / `build` run `pnpm assets` first, which copies SQLite WASM and the OO1 worker into `public/` (those files are **not** committed; only static assets belong in git).

OPFS persistence requires COOP/COEP headers. This example sets them via `next.config.ts`.

