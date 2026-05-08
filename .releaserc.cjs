/**
 * semantic-release drives versions from git history since the last semver tag (`v*`).
 *
 * Prerequisites:
 * - Baseline git tag `v*` matching `packages/sqlite-promiser` `version` (e.g. `v0.1.0`) before relying on automation,
 *   so the first bump isn’t derived from the entire repo history.
 *
 * Secrets (workflow):
 * - `NPM_TOKEN`: must allow publishing `sqlite-promiser`. Until the name exists on npm, use a Classic
 *   Automation token or a Granular token with Publish (e.g. all packages); restrict to this package after the first publish.
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
