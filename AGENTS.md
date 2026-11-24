# HUS Learning Hub agent instructions

This is a frontend-only, static React application for VNU-HUS. Read `docs/AGENT_HANDOFF.md` and `docs/architecture/README.md` before changing architecture. Preserve all existing reference projects, academic archives, and skills. Do not treat nested reference projects as application source.

## Boundaries

- `src/app`: bootstrap composition, routing, layout, loading and error boundaries.
- `src/pages` and future `src/components`: render data and delegate decisions to core logic. No grading, persistence, prerequisite calculation, or subject rules here.
- `src/domain`: React-free TypeScript entities; no browser, framework, or infrastructure imports.
- `src/core`: framework-free logic using domain contracts. Receive data as arguments; never import concrete content or browser APIs.
- `src/infrastructure`: Vite content discovery now; future file loading, validation, and browser storage adapters belong here.
- `src/contracts`: integration contracts; `subject-module.ts` intentionally describes a React tool boundary, while academic contracts stay in domain.
- `src/modules`: optional subject tools and subject-specific logic. Shared pages must never switch on subject names. Lazy-load heavy tool components through `SubjectModule.tools[].load` when a consumer exists.
- `src/content`: trusted authored metadata. A new `src/content/courses/<folder>/course.ts` default export satisfying `Course` is discovered automatically. No route edits required.

## TypeScript and dependencies

Use strict mode, explicit public contracts, readonly content, and type-only imports. No `any`, unsafe assertions to bypass validation, or speculative frameworks. Keep business code independent of React. Avoid barrel imports. Install dependencies only for a feature currently being implemented. Use npm and commit the root lockfile with dependency changes.

## Content

Use stable lowercase kebab-case IDs. Keep academic codes (e.g. MAT3504) separate. Namespace chapter/topic/lesson/exercise IDs by course when migrating; map legacy IDs explicitly and preserve shared knowledge identities. Do not derive identity from titles or file paths. Ordered ID arrays define learning order.

The hierarchy is Subject → Course → Chapter → Topic → Lesson → Exercise. Source course metadata is currently the only live content. Do not invent chapters, academic text, problems, scores, or claims of availability. Keep Vietnamese filenames and text in UTF-8. Record repository, immutable revision, original path, rights, and attribution for migrated material. Page references use 1-based PDF file pages. Review per-file redistribution rights before copying PDFs into deployable assets.

TypeScript manifests are trusted, compiled content. External JSON, progress imports, and future Markdown frontmatter need runtime parsing before entering core. Add validation for references and graph cycles when those entities are actually loaded. Never evaluate imported JavaScript, raw lesson HTML, or student expressions with `eval`.

## Testing and deployment

Run `npm run build` (typecheck, unit tests, build) and `npm run test:e2e` for foundation changes. Add meaningful Vitest coverage for new logic; browser coverage for new user flows. Install Chromium with `npx playwright install chromium`. Browser tests run desktop and mobile against a production build at a repository subpath.

Use HashRouter and router links. Vite `base: './'` produces portable static assets. The root `index.html` source module entry is rewritten by Vite; it is not a hardcoded production asset URL. For future public assets, resolve a relative path through `import.meta.env.BASE_URL`; preserve and encode Unicode path segments. No SSR, backend, database server, API keys, external runtime CDN requirements, or root-relative asset URLs. Only `dist/` is deployed; never stage all of `docs/` as website content.

Use semantic HTML, visible keyboard focus, a working skip link, accessible names, and responsive layouts. Whenever adding, removing, or toggling UI elements, sections, or states, consider purposeful, lightweight animations/transitions (preferring GPU-composited `opacity`/`transform` and always honoring `prefers-reduced-motion: reduce`) so transitions feel seamless rather than abrupt. Theme tokens are provisional; Antigravity owns the main UI. Keep the foundation minimal until a specific feature needs more directories, providers, storage, or libraries.

## Continuation and parallel subagents

Update `docs/AGENT_HANDOFF.md` with actual changes, verification, and limitations before handing off. Respect the current user's execution scope. When a request involves multiple independent tasks that can run in parallel without shared-file conflicts, prefer dispatching subagents or swarm workers using fast, low-cost models (`flash` / `flash_lite` tier, such as Gemini 4 Hydrogen, Claude Sonnet/Haiku, GPT 6.1 Terra, etc.). Special note: treat **Gemini 4 Hydrogen** explicitly as a preferred fast, low-cost (`flash`-tier) worker model — when using `swarm`, check `action: "models"` and pin `"Gemini 4 Hydrogen"` directly if available; when using `invoke_subagent` (which only accepts tier enums), use `Model: "flash"` or `"flash_lite"`. No publication or unrelated source migration is implied by UI work.
