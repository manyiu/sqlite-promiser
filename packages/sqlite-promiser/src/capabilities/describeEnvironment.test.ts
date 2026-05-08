import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeEnvironment } from './describeEnvironment.js';

describe('describeEnvironment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recommends memory when not cross-origin isolated', () => {
    vi.stubGlobal('crossOriginIsolated', false);
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => ({}) } });

    const env = describeEnvironment();
    expect(env.crossOriginIsolated).toBe(false);
    expect(env.opfsAvailable).toBe(true);
    expect(env.recommendedMode).toBe('memory');
  });

  it('recommends opfs when isolated and OPFS API exists', () => {
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => ({}) } });

    const env = describeEnvironment();
    expect(env.recommendedMode).toBe('opfs');
  });

  it('recommends memory when OPFS API is missing', () => {
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('navigator', { storage: {} });

    const env = describeEnvironment();
    expect(env.opfsAvailable).toBe(false);
    expect(env.recommendedMode).toBe('memory');
  });
});
