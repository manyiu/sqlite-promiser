/**
 * semantic-release drives versions from git history since the last semver tag (`v*`).
 *
 * Prerequisites:
 * - Baseline git tag `v*` matching `packages/sqlite-promiser` `version` (e.g. `v0.1.0`) before relying on automation,
 *   so the first bump isn’t derived from the entire repo history.
 *
 * npm publishing (CI):
 * - GitHub Actions uses npm Trusted Publishing (OIDC). No `NPM_TOKEN` — see `.github/workflows/release.yml`.
 * - `@semantic-release/npm` performs the OIDC token exchange when `id-token: write` is granted.
 */

/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    [
      '@semantic-release/changelog',
      { changelogFile: 'packages/sqlite-promiser/CHANGELOG.md' }
    ],
    ['@semantic-release/npm', { pkgRoot: 'packages/sqlite-promiser' }],
    [
      '@semantic-release/git',
      {
        assets: ['packages/sqlite-promiser/package.json', 'packages/sqlite-promiser/CHANGELOG.md'],
        message: 'chore(release): sqlite-promiser ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ],
    '@semantic-release/github'
  ]
};
