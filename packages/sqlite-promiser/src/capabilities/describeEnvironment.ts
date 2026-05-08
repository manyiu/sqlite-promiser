/** Feature snapshot of the current runtime relevant to SQLite WASM + OPFS. */
export type EnvironmentDescription = {
  /** `true` when the document is cross-origin isolated (COOP/COEP). */
  crossOriginIsolated: boolean;
  /** `true` when OPFS primitives appear available (`navigator.storage.getDirectory`). */
  opfsAvailable: boolean;
  /** Library hint: `'opfs'` only when isolation and OPFS are both usable. */
  recommendedMode: 'opfs' | 'memory';
};

type GlobalWithIsolation = typeof globalThis & { crossOriginIsolated?: boolean };

function navigatorHasOpfs(nav: Navigator): boolean {
  const storage = (nav as Navigator & { storage?: StorageManager }).storage as
    | (StorageManager & { getDirectory?: () => Promise<unknown> })
    | undefined;
  return typeof storage?.getDirectory === 'function';
}

/**
 * Probe globals for cross-origin isolation and OPFS readiness.
 *
 * Safe to call from any JS context that defines `navigator`/`globalThis`; values are booleans suitable for UX or telemetry.
 *
 * @returns Stable description used by {@link createDatabase} when choosing initial open strategy.
 */
export function describeEnvironment(): EnvironmentDescription {
  const crossOriginIsolated =
    typeof globalThis !== 'undefined' && (globalThis as GlobalWithIsolation).crossOriginIsolated === true;
  const opfsAvailable = typeof navigator !== 'undefined' && navigatorHasOpfs(navigator);

  const recommendedMode = crossOriginIsolated && opfsAvailable ? 'opfs' : 'memory';
  return { crossOriginIsolated, opfsAvailable, recommendedMode };
}
