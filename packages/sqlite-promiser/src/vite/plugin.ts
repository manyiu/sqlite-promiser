/**
 * Optional Vite integration: COOP/COEP headers and dev/preview `origin` for custom hostnames.
 *
 * @module sqlite-promiser/vite
 */
import type { Plugin } from 'vite';
import { headersPresets } from '../headers/headersPresets.js';

/**
 * Vite plugin for local OPFS-friendly setup.
 *
 * - When `VITE_COOP=1`, sets {@link headersPresets `requireCorp`} on `server` and `preview` unless
 *   `VITE_COOP_POLICY=credentialless` (then uses {@link headersPresets `credentialless`}).
 * - When `VITE_DEV_ORIGIN` is set (e.g. `https://localhost.example.com:5173`), sets `server.origin`
 *   and `preview.origin` so generated absolute URLs match the page origin.
 */
export function sqlitePromiserDevPlugin(): Plugin {
  const coop = process.env.VITE_COOP === '1';
  const credentialless = process.env.VITE_COOP_POLICY === 'credentialless';
  const origin = process.env.VITE_DEV_ORIGIN;

  const headers = coop ? (credentialless ? headersPresets().credentialless : headersPresets().requireCorp) : undefined;

  return {
    name: 'sqlite-promiser-dev',
    config() {
      return {
        server: {
          ...(origin ? { origin } : {}),
          ...(headers ? { headers } : {})
        },
        preview: {
          ...(origin ? { origin } : {}),
          ...(headers ? { headers } : {})
        }
      };
    }
  };
}
