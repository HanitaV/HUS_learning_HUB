# Agent handoff

## Public Template Branch (`template`) — 2026-11-25 (Antigravity)

Prepared a clean, content-free public template branch (`template`, orphan history with zero private content or commit history) for `https://github.com/HanitaV/HUS_learning_HUB`:

- **Removed all subjects, courses, and private content**:
  - Removed all authored course folders under `src/content/courses/*`, course-specific animations, skill quests, MIT overlays, course-specific chemistry/physics modules, migration scripts (`scripts/`), and private migration inventories/ID maps.
  - Emptied `src/content/subjects.ts`, `src/modules/subjects.ts`, `src/content/code-lab/problems.ts`, `src/content/blocks/{parsons-bank,proof-bank}.ts`, `src/content/curriculum-canons.ts`, and per-subject/course/chapter presets in `src/content/math-symbols.ts`.
  - Updated `src/infrastructure/quests/registry.ts` and `src/infrastructure/animations/loader.ts` to auto-discover authored modules via `import.meta.glob`.
  - Removed the private Vercel Origin Trial token from `index.html` and replaced hardcoded origin info in `src/infrastructure/ai/webmcp-essay-bridge.ts` with a generic template placeholder.
  - Added a clear template empty state on `CataloguePage.tsx` when `allCourses.length === 0`.
- **Added comprehensive template documentation & deployment workflows**:
  - Rewrote `README.md` for the template repository.
  - Added `docs/ADDING_SUBJECTS_AND_CONTENT.md` covering subjects, courses, chapters, topics, Markdown lessons, objective exercises, guided written essays, 9 interactive diagrams, search index, math presets, AI canons, lazy subject tools, and validation.
  - Added `docs/DEPLOYMENT.md` and `.github/workflows/deploy-pages.yml` covering Vercel, GitHub Pages, Cloudflare Pages/Netlify, and optional WebMCP Origin Trial setup.
- **Verification**:
  - Updated unit tests (`catalogue.test.ts`, `registry.test.ts`, `search.test.ts`, `graph.test.ts`, `math-symbols.test.ts`, `curriculum-rag-webmcp.test.ts`) to use self-contained fixtures and updated E2E tests (`foundation.spec.ts`, `workspace.spec.ts`) for the zero-course template shell under `/HUS_learning_HUB/`.
  - Verified with `npm run build` (`tsc --noEmit` + Vitest + Vite `dist/`) and `npm run test:e2e` (Desktop & Mobile Chromium).
