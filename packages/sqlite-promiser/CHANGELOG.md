## [1.0.1](https://github.com/manyiu/sqlite-promiser/compare/v1.0.0...v1.0.1) (2026-05-13)

### Bug Fixes

* **ci:** restore npm Trusted Publishing for semantic-release ([06bc73f](https://github.com/manyiu/sqlite-promiser/commit/06bc73f5a14893fd95dadfe0a47568d251e38165))

## 1.0.0 (2026-05-13)

### ⚠ BREAKING CHANGES

* Custom OpenOptions.worker must load the OO1 RPC worker bundle
(sqlite-promiser/worker or equivalent dist/sqlite-oo1-worker.js), not
sqlite3-worker1.mjs. npm subpath exports sqlite-promiser/worker and
sqlite-promiser/sqlite3.wasm are added for asset pipelines.

Co-authored-by: Cursor <cursoragent@cursor.com>

### Features

* replace Worker1 promiser with sqlite3InitModule + OO1 worker ([7998fa4](https://github.com/manyiu/sqlite-promiser/commit/7998fa4654e790eadfb553c4f2272bad7392ec8a)), closes [#1](https://github.com/manyiu/sqlite-promiser/issues/1)

## [1.0.0](https://github.com/manyiu/sqlite-promiser/compare/v0.1.0...v1.0.0) (2026-05-13)

### ⚠ BREAKING CHANGES

* Custom OpenOptions.worker must load the OO1 RPC worker bundle
(sqlite-promiser/worker or equivalent dist/sqlite-oo1-worker.js), not
sqlite3-worker1.mjs. npm subpath exports sqlite-promiser/worker and
sqlite-promiser/sqlite3.wasm are added for asset pipelines.

Co-authored-by: Cursor <cursoragent@cursor.com>

### Features

* replace Worker1 promiser with sqlite3InitModule + OO1 worker ([536ecf8](https://github.com/manyiu/sqlite-promiser/commit/536ecf8de56fe024768922fd75263b55670ca730)), closes [#1](https://github.com/manyiu/sqlite-promiser/issues/1)
