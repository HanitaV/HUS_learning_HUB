# Foundation implementation plan

The user supplied the architecture brief and requested direct, in-place implementation with no agent delegation. Existing docs, skills, and local reference projects must be preserved. No commits or publication are part of this session.

1. Inspect local files and upstream trees, manifests, README files, schemas, and resource paths. Record immutable upstream revisions and migration issues.
2. Configure React, strict TypeScript, Vite, Tailwind, Vitest, and Playwright. Write registry and browser acceptance tests before their implementation; verify the missing implementation fails.
3. Define React-independent hierarchy, resource, knowledge, and progress contracts; a small React integration contract for optional subject tools; and a validated, typed metadata registry. Discover course manifests without route edits.
4. Add bootstrap, HashRouter, lazy pages, loading and error boundaries, and a plain accessible catalogue/detail shell. Do not migrate lesson bodies or PDFs.
5. Configure CI and GitHub Pages artifact deployment, then run install, typecheck, unit tests, production build, subpath browser tests, and a development server smoke check.
6. Review the implementation against the brief; document actual structure, content conventions, limitations, and continuation steps in AGENTS.md and AGENT_HANDOFF.md.

Review focus: duplicate IDs, unknown subjects, route-safe IDs, caller mutation, unknown routes, hash-route refresh, mobile overflow, asset failures under a repository subpath, and accidental inclusion of local archives in deployment.

## Execution record

All six steps implemented in place. Registry tests initially failed because the module did not exist, then passed after implementation. Final verification: npm ci succeeded, 5 unit tests, strict typecheck and production build passed; 6 production browser checks and a separate development browser smoke passed. The browser harness was corrected after tracing a script MIME failure to a mismatch between build and preview bases. Final checks exercise the default relative build mounted under a repository subpath.

Self-review against the supplied brief completed; no independent reviewer or other coding agent was launched, as requested. Existing user files were not edited. No commits or publication performed.
