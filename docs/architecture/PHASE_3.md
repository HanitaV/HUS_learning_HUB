# Phase 3: learning integration

The existing Antigravity shell, tokens, responsive layouts and routes are retained. This is a working content slice, not a full migration of the reference sites. No branch, agent, commit, publication or reference-tree modification was performed.

## Audit and source decisions

Root source, component contracts, tests, configuration, workflow and architecture documentation were reviewed. The supplied app had real navigation/theme/course filters but only MAT3504 metadata. Lesson rendering, syllabus navigation, resource resolution, exercise callbacks, history and progress were disconnected. The chapter link used a chapter ID as a lesson ID. Root files were all untracked at the start, so there is no tracked before/after diff.

The three upstream repositories were accessible through the GitHub connector. Their immutable directory listings were checked again. Physics theory/exercise blobs match upstream byte for byte. Metadata migration checks Git blob hashes, normalizing checkout CRLF to source LF. Nothing imports or executes legacy JS: the Physics migration uses TypeScript's scanner to read a strict literal subset, rejecting functions and expressions.

| Source | Integrated here | Rights / remaining scope |
| --- | --- | --- |
| DSA-HUS `01e2385bc1bbf16e3b7a2ab527e1b572ae06360d` | MAT3504, MAT3514, THCS4, OOP identifiers/titles and immutable source links | No declared license. No lesson bodies, code or PDFs copied. |
| Chemistry `ad043333d24f67da5d11611678754397f4595e49` | General chemistry metadata; 4 PDF source links, 1 YouTube reference and source directory | No declared license. PDFs, 48 lessons and exercise banks remain upstream. Video is an external link, not an embedded player. |
| VLDC-HUS `5d6301638664dc18b4913b944c0224761d705a2e` | PHY1159: 2 chapters, 5 topics/Markdown lessons, 3 conceptual exercises from authored software data | MIT notice in `public/licenses/VLDC-HUS-MIT.txt`. Teacher PDFs and verbatim PDF problem banks excluded. |
| Local HUS-learning-resource | Inspected archive groups: CHE1080 LaTeX exercises/exams, `gt1` calculus, `xstk` probability/statistics | No verified per-file rights/revision for redistribution; not made available in the app. |

See [reference inventories](REFERENCE_ANALYSIS.md) for source structure and [explicit Physics ID mappings](PHYSICS_ID_MAP.json). Source `T1.1`–`T2.3` map to `phy1159-t1-1`–`phy1159-t2-3`; `L1.1`, `L1.2`, `L2.1` map to scoped exercise IDs. L1.1 is adapted from ordering to a numbered exact short answer; the source steps/explanation are retained. Multiple-answer logic/UI exists and is tested, but none of these migrated source questions requires that type. No fictional academic question is published to demonstrate it. This is not a complete academic correctness review.

## Architecture

`domain/workspace.ts` adds discriminated exercise definitions, normalized content collections and versioned workspace progress. Existing academic hierarchy and course identities stay intact. `core/learning` owns graph/reference validation, grading, progress transitions/backup parsing, search and deterministic replay. It imports no React, content or browser APIs.

`infrastructure/content/learning.ts` composes authored content globs and validates ownership, unique IDs, child references, prerequisite cycles, answers, resource paths and Markdown existence. `catalogue.ts` still discovers `course.ts` without route edits. Markdown bodies are separate lazy raw-import chunks. Optional full-text `search-index.ts` files load with the lazy catalogue page; summaries remain in content metadata. Search covers subject/course/chapter/topic/lesson/resource records, folds Vietnamese diacritics including đ, and matches every query token. The built-in renderer skips raw HTML and rejects executable URLs; KaTeX trust is disabled. Code highlighting supports fenced language blocks. `#/courses/...` Markdown links use the router. Images are currently rendered as their alt text rather than fetching arbitrary image URLs.

`SubjectModule.tools[].load` remains the only React tool boundary. The independent sorting activity uses `core/learning/replay.ts`; immutable snapshots make forward/back/reset deterministic. The UI owns playback index, speed and timer cleanup. Tools load only after selecting a tool tab. It is labeled as an independent algorithm example, not migrated MAT3504 teaching material.

## Authoring actual content

1. Add a subject to `src/content/subjects.ts` if needed. Create `src/content/courses/<folder>/course.ts` default-exporting a readonly object satisfying `Course`. Use a stable lowercase ID, keep an academic code separate, and record repository/revision/original path/rights. Keep status `metadata-only` until actual lessons exist.
2. Add `content.ts` default-exporting an object satisfying `LearningContent` with `chapters`, `topics`, `lessons`, `exercises`, `resources`. Follow `src/content/courses/phy1159/content.ts`. Ordered child ID arrays determine navigation, independent of physical manifest order. Parent membership must agree in both directions. Topic `prerequisiteIds` reference topic IDs and must be acyclic; prerequisites are recommendations, not enforced locks.
3. Put UTF-8 lesson bodies in `lessons/<id>.md`. `content.assetPath` is relative to `src/content/courses/`, for example `phy1159/lessons/phy1159-t1-2.md`. Set format to `markdown`. Use `$...$`/`$$...$$` for math and fenced blocks such as `python` or `typescript` for code. Put routing links in the form `#/courses/phy1159/lessons/phy1159-t1-2`.
4. Exercise records use `id`, `lessonId`, `title`, `prompt`, optional `explanation` and provenance. Choice types use `choices: [{id, label}]` and `answers: ['option-1']`; multiple-choice requires exactly one answer. Multiple-answer requires exact set equality and rejects duplicate/unknown responses. Short answers use an explicit nonempty accepted-string list; comparison folds case/diacritics and trims outside whitespace. It does not evaluate formulas or silently accept equivalent expressions. Put each exercise ID in its lesson's ordered `exerciseIds`.
5. Link resources by `resourceIds`. External/PDF/YouTube records have an HTTPS `url`. An approved local asset uses relative `assetPath`, e.g. `assets/phy1159/<original filename>.pdf`, under `public/`. The adapter adds `BASE_URL`, encodes Unicode segments and uses `#page=N` for the first 1-based file-page reference. No assets with unreviewed rights may be bundled. Preserve attribution and distribute the applicable license notice. Current PDFs open on GitHub; there is no in-app PDF renderer.
6. For full-text search, add `search-index.ts` default-exporting a readonly record from stable lesson ID to indexable plain text. Otherwise title/summary search still works. Do not make Markdown bodies eager just for search.
7. Register a tool in `src/modules/subjects.ts` with a stable ID, title, kind and dynamic `load`. The component receives `courseId`; calculations belong in framework-free core/module logic. Shared pages must not switch on a subject name.
8. Run `npm run build` and `npm run test:e2e`. Actual authored TS is compiled/trusted, then its relationships are validated. External JSON is not a live content source; it requires a runtime parser before entering core. Do not import legacy executable manifests as a shortcut.

Reproducible selective migrations: `node scripts/import-physics.mjs` and `node scripts/import-source-metadata.mjs`. They verify the explicitly selected source hashes before generating files. They depend on the preserved local reference copies; normal build/CI does not. Physics uses the installed TypeScript 7 scanner API; recheck compatibility when upgrading TypeScript.

## Local persistence

`infrastructure/progress/store.ts` implements the narrow storage port and a single external store; React subscribes with `useSyncExternalStore`. Core owns its pure reducer. The key is `hus-learning-hub:progress:v1`, separate from all legacy app keys. It stores completed lesson IDs, bookmarked resource IDs, the 20 most recent distinct topics with resume lessons, and the last 1,000 exercise outcomes/timestamps. It records no server identity or exam-grade claim.

Progress percentages count completed known lessons over known lessons; a course without lessons has no earned progress. Completion is a manual toggle, independent of exercise results. JSON export is available on Progress. Restore explicitly replaces the current snapshot, has a 5 MB bound, parses unknown JSON, checks versions/types/IDs/uniqueness/timestamps, strips unknown properties, and leaves current data intact on invalid input. Unknown well-formed entity IDs are retained so backups survive temporary content removal. A corrupt stored value is preserved until an explicit valid restore; further changes remain in memory with a warning. Blocked/quota-limited storage also keeps working in memory with a visible warning.

This is browser/origin-local storage, not a backup service. Clearing site data loses it. There is no legacy database import, cross-device sync or concurrent-tab reconciliation; use one active learning tab and export backups. The data format/port can be adapted to a future backend without changing grading logic.

## Python feasibility decision

Pyodide is feasible as a progressive enhancement, but is not shipped in this slice. No Python runtime assets were present, and an external runtime CDN would violate the project's local-runtime constraint. A text box that cannot execute locally was deliberately not added.

The [official Worker guide](https://pyodide.org/en/stable/usage/webworker.html) supports a module Worker and message-based execution. The [bundler/self-hosting guide](https://pyodide.org/en/latest/usage/working-with-bundlers.html) explains local runtime distribution. A future implementation must pin and copy a matching runtime, Wasm, standard library and metadata into relative public assets (with notices), lazy-create a module Worker only on explicit use, buffer stdout/stderr, and expose load/execution errors. Cancellation should terminate the Worker and recreate it on the next run. This avoids depending on SharedArrayBuffer/security headers: [Pyodide interrupt buffers require those headers](https://pyodide.org/en/stable/usage/keyboard-interrupts.html), which are not supplied by this static deployment. Test actual runtime load, print/error, infinite-loop cancellation, rerun and subpath URLs before registering the tool. A Worker is a responsiveness boundary, not a security sandbox for hostile code.

## Deployment and known limits

HashRouter, Vite `base: './'`, locally bundled fonts and dist-only GitHub Pages deployment remain. `npm run build` typechecks, runs unit tests (including every real manifest/body), then builds; `npm run test:e2e` repeats the build and serves it under `/HUS_Learning_Page/`. Set Pages source to GitHub Actions. No hosted deployment was performed.

The lazy Markdown/math/highlighting chunk is about 557 kB minified / 171 kB gzip and triggers Vite's chunk-size advisory. It is not loaded by the dashboard, course overview or progress route; reducing language/font payload is a future performance pass. Content metadata/exercise definitions are currently eager and small; split exercise banks behind validated lazy loaders before importing hundreds of questions. There is no IndexedDB personal-document library, offline service worker, embedded video/PDF player, arbitrary HTML/images, symbolic/numeric expression engine, Python runner or wholesale subject migration.

Antigravity priorities: inspect typography/math/exercise option spacing in the real lesson workspace in both themes; refine progress/backup and long resource/attribution rows using existing tokens; improve keyboard tool-tab semantics and lesson outline navigation; reduce reader payload; coordinate rights-cleared chemistry/DSA content batches and academic review. The UI changes here are functional connections, with no new visual system.
