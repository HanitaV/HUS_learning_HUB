# HUS Learning Hub Architecture

This document summarizes the architectural boundaries of the **HUS Learning Hub** static platform template. For hands-on authoring and deployment guides, see:

- [Adding Subjects, Courses & Content](../ADDING_SUBJECTS_AND_CONTENT.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [Course Catalogue Scalability](COURSE_CATALOGUE_SCALABILITY.md)
- [Written Practice Architecture](WRITTEN_PRACTICE.md)

## Key Architectural Decisions

| Choice | Rationale |
| --- | --- |
| One static React/Vite application | Shared navigation, progress, search, and exercise engines without duplicating apps. |
| Pure TypeScript `domain` + `core` | Academic contracts, DAGs, grading, and Graph-RAG stay testable without React or browser APIs. |
| Glob discovery (`import.meta.glob`) | Adding a subject or course requires zero route edits; heavy Markdown, exercises, and tools load lazily. |
| Stable kebab-case IDs | Routes survive title edits; academic codes (`academicCode`) stay separate from identity. |
| Normalized hierarchy | `Subject → Course → Chapter → Topic → Lesson → Exercise` with ordered ID arrays. |
| Optional lazy subject tools | Declarative `SubjectModule` contract in `src/contracts/subject-module.ts`; shared pages never switch on subject names. |
| `HashRouter` + `base: './'` | Portable static `dist/` output works at `/`, repository subpaths, or custom domains with zero server rewrites. |
| Local-first persistence | Versioned `localStorage` with JSON export/import and zero backend or API keys. |

## Dependency Direction

```text
app → pages → infrastructure → core → domain
           ↘ components     ↘ domain
modules → contracts → domain
                   ↘ React types (integration boundary only)
```

- `src/domain`: React-free TypeScript entities; no browser or framework imports.
- `src/core`: Pure functions taking domain data as arguments; never imports concrete content or browser APIs.
- `src/infrastructure`: Vite glob loaders, runtime parsers/validators, WebMCP bridge, WASM runtimes, and `localStorage` adapters.
- `src/modules`: Optional lazy-loaded subject tools (WASM Code Lab, Parsons Studio, Proof Blocks, 9 interactive diagram renderers, Skill Quest Studio).
- `src/content`: Authored subjects, courses, lessons, exercises, and optional presets.
