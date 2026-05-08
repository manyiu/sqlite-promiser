/** Header name/value map suitable for HTTP response `headers`, Vite server config, or Next.js `headers()`. */
export type HeaderPreset = Record<string, string>;

/**
 * Ready-made COOP/COEP presets to achieve cross-origin isolation for OPFS-capable deployments.
 *
 * You must still configure your CDN/server to emit these headers; this helper only produces the pairs.
 *
 * @returns Named presets; pick one that matches your security/deploy tradeoffs for third-party embeds.
 */
export function headersPresets(): {
  /**
   * Strictest/common: enables crossOriginIsolated, but may break third-party
   * embeds if they do not set CORP/CORS correctly.
   */
  requireCorp: HeaderPreset;
  /**
   * Alternative which can be less disruptive for some deployments.
   * Not all browsers/environments treat this the same.
   */
  credentialless: HeaderPreset;
} {
  return {
    requireCorp: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    credentialless: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  };
}

