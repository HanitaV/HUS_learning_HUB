# HUS Learning Hub (Template)

A frontend-only, static educational platform template built with **React 19**, **strict TypeScript**, **Vite**, **React Router (`HashRouter`)**, and **Tailwind CSS v4** — with zero backend, zero database server, and zero API keys required.

This `template` branch ships with **no pre-bundled subjects or course content**, giving you a clean starting point with all platform engines and UI components ready to extend.

## Included Platform Capabilities

- **Automatic Content Discovery**: Drop a `course.ts` (and optional `content.ts`, `lessons/*.md`, `exercises.ts`, `written-practice.ts`, `semi-essays.ts`, `search-index.ts`) under `src/content/courses/<course-id>/` — routes, catalogue, prerequisite graphs, and search wire up automatically.
- **Rich Academic Markdown & Math**: GitHub Flavored Markdown, syntax-highlighted code blocks, and KaTeX math rendering (`$...$` and `$$...$$`).
- **Interactive Exercises, Inline Labs & Exam Workbench**:
  - Classic objective exercises (`multiple-choice`, `multiple-answer`, `short-answer` with math glyph normalization) and declarative SVG problem figures (`plot-2d` & 19 `physics-schematic` scenes via `<ProblemFigure />`).
  - Inline multi-step guided written-reasoning & diagram cards directly inside lessons (`InlineSemiEssayExerciseCard`), chapter exams (`ChapterExamPage`), and a dedicated **Written Exam Practice Workbench** (`/#/exams` — `100% Tự luận giấy A4` ↔ `Đề hỗn hợp`), with **9 lazy-loaded interactive diagram kinds** (`fbd`, `heatmap`, `curve-2d`, `balance-flow`, `mo-diagram`, `prob-tree`, `algo-trace`, `proof-dag`, `parsons-flow`) and live `localStorage` draft persistence.
  - Lag-free Ruled A4 essay sheets with realtime KaTeX preview (`<RealtimeMathPreview />`), 78-button math symbol toolbar, `Ký hiệu` / `Mathlib \` / `LaTeX` input modes, and 95+ `\` shorthands.
  - Optional `studyMode: 'practice-only'` per course so practice-focused courses open directly into exercises and track mastery from solved problems.
- **Grounded AI Tutor & NotebookLM Export (Zero API Keys, Zero Local Prompt API)**:
  - Deterministic Curriculum Graph-RAG with topological prerequisite horizon guard and visual-context summaries.
  - Adaptive Dual-Path **WebMCP** (`document.modelContext`) + **✨ Ask Gemini** prompts with `/10` Mức-1 rubric grading, custom-shorthand-to-LaTeX compilation, and 1-click single-question or whole-exam JSON sync.
  - On-demand `.md` syllabus bundle exporter for Google NotebookLM.
- **Optional Lazy Subject Tools**:
  - In-browser **Python (Pyodide)** & **Java (CheerpJ)** WASM Code Lab (`src/modules/code-lab/CodeLabWorkspace.tsx`).
  - **Parsons Code Blocks** (`src/modules/blocks/ParsonsStudio.tsx`), **Proof Blocks DAG** (`src/modules/blocks/ProofBlocksStudio.tsx`), and **Skill Quests** (`src/modules/quests/SkillQuestStudio.tsx`).
- **Local-First Progress & Portable Static Output**:
  - Versioned `localStorage` persistence with JSON backup/restore (`#/settings`).
  - Relative Vite build (`base: './'`) + `HashRouter` works at `/`, repository subpaths (e.g., `/HUS_learning_HUB/`), or custom domains.

## Quick Start

Node.js **22.12+** and npm are required.

```sh
npm ci
npm run dev
```

Run checks and production build:

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run build` runs TypeScript typechecking, all Vitest unit tests, and the Vite production build into `dist/`.

## Documentation

- **[Adding Subjects, Courses & Content](docs/ADDING_SUBJECTS_AND_CONTENT.md)** — step-by-step guide to registering subjects, courses, chapters, Markdown lessons, exercises, written essays, interactive diagrams, math presets, and lazy subject tools.
- **[Deployment Guide](docs/DEPLOYMENT.md)** — deploying `dist/` to **Vercel**, **GitHub Pages**, **Cloudflare Pages**, **Netlify**, or any static host, plus optional **WebMCP Origin Trial** configuration.
- **[Architecture Overview](docs/architecture/README.md)** — layer boundaries, dependency direction, and design decisions.
- **[System Guide](docs/SYSTEM_GUIDE.md)** — detailed reference on workspace features and pedagogy.

## Project Structure

```text
.github/workflows/
  deploy-vercel.yml         Manual Vercel deployment workflow
  deploy-pages.yml          Manual GitHub Pages deployment workflow
docs/
  ADDING_SUBJECTS_AND_CONTENT.md
  DEPLOYMENT.md
  architecture/             Architecture decisions & scalability notes
src/
  app/                      Bootstrap, HashRouter, ErrorBoundary, AppLayout
  pages/                    Catalogue, Courses, Course, Lesson, Practice, Quest, Progress, Settings
  components/               UI primitives, Markdown viewer, exercise/essay studio, math toolbar
  domain/                   Pure TypeScript entities (no React or browser imports)
  core/                     Framework-free logic (registry, validation, DAG, grading, Graph-RAG)
  infrastructure/           Vite glob discovery, localStorage adapters, WASM runtimes, WebMCP bridge
  contracts/                React integration contracts for lazy subject tools & diagrams
  modules/
    subjects.ts             Optional lazy subject tools & hero backdrops (empty in template)
    code-lab/               WASM Python & Java Code Lab
    blocks/                 Parsons & Proof Blocks studios
    diagrams/               9 lazy interactive diagram renderers
    quests/                 Skill Quest studio
  content/
    subjects.ts             Subject registry (empty in template)
    curriculum-canons.ts    Optional per-course notation canons & reasoning scaffolds
    math-symbols.ts         95+ math symbols & optional per-subject/course/chapter presets
    code-lab/problems.ts    Optional coding problems with test cases
    blocks/                 Optional Parsons & Proof Block banks
    courses/<course-id>/    Drop your courses here (auto-discovered by Vite glob)
tests/
  unit/                     Vitest unit tests
  e2e/                      Playwright desktop + mobile Chromium tests
```
