# Agent handoff

## Sync WebMCP Waves 1–3, Quad-Discipline Brand Identity, Mobile-First Drawer & Concise Exam Scaffold from `main` — 2026-11-26 (Antigravity)

Synced all latest platform upgrades from `main` (`cfac129`) onto the clean `template` branch (`public/template` on `https://github.com/HanitaV/HUS_learning_HUB.git`) while keeping zero proprietary course content or private Origin Trial tokens:

- **WebMCP Ecosystem Waves 1–3 (`src/core/{learning,code-lab}/*`, `src/infrastructure/{ai,progress}/*`, `src/app/use{ExamWebMcpBridge,WebMcpActivity}.ts`, `src/pages/{ExamPracticePage,ChapterExamPage,ProgressPage,SettingsPage}.tsx`)**:
  - Synced Graph-RAG BM25 index caching, owner-stack WebMCP coordinator, `hus_submit_exam_batch_coaching`, per-step revision history & diff timelines (`coaching-memory.ts`), cross-step interactive diagram summaries (`interactive-draft-summary.ts`), Mistake & Convention Ledger (`study-diagnostics.ts`, `hus_get_study_diagnostics`, `hus_launch_targeted_drill`), `v2` Study Archive (`study-archive.ts`), 3-mode NotebookLM exports, `CodeLabWorkspace` Socratic debug coaching, Declarative HTML WebMCP `<form toolname="...">` attributes, and the non-mutating 10-tool WebMCP Dry-Run console on `SettingsPage`.
  - Preserved `template`'s generic `https://your-domain.example` placeholder in `webmcp-essay-bridge.ts`, empty `COURSE_CONVENTION_CANONS = {}` (adding `concise-equation-chain` `"Biến đổi dòng ngắn gọn (chuẩn đáp án thi)"` to `DEFAULT_REASONING_SCAFFOLDS`), and clean zero-course empty states on `CataloguePage` & `ExamPracticePage`.
- **Quad-Discipline Brand System, Universal `☰` Drawer, Study Method Banner & Mobile-First Ergonomics (`src/components/ui/BrandIdentity.tsx`, `src/components/learning/CourseStudyGuideBanner.tsx`, `src/app/layouts/AppLayout.tsx`, `DESIGN.md`, `public/favicon.svg`, `src/styles/index.css`)**:
  - Synced `SubjectVisualTheme` (`sapphire | emerald | amber | violet`), `HusBrandCrest`, checkable color-coded subject/course/chapter tiles, universal `☰` corner curriculum drawer on desktop & mobile, `CourseStudyGuideBanner`, and thumb-zone mobile bottom navigation (removing the blocking `SmallScreenNoticeModal` interruption).
- **Verification**:
  - Verified on `template` with `npm run build` (`tsc --noEmit` + Vitest + Vite production `dist/`) and `npm run test:e2e` (Desktop & Mobile Chromium, zero horizontal overflow `360px`–`1440px`).

---

## Sync Exam Workbench, Inline Multi-Step Labs, `<ProblemFigure />`, Realtime KaTeX A4 & Dual-Path WebMCP from `main` — 2026-11-25 (Antigravity)

Synced all latest platform capabilities from `main` (`abc7cb0`) onto the clean `template` branch (`public/template` on `https://github.com/HanitaV/HUS_learning_HUB.git`) while preserving zero course/private content:

- **Exam Workbench (`/#/exams` & `ChapterExamPage`), Ruled A4 & Realtime KaTeX Preview**:
  - Synced `ExamPracticePage.tsx` (adding a clean zero-course starter state when `availableCourses.length === 0`), `ChapterExamPage.tsx`, `ExamWebMcpStatusBar.tsx`, `ExamObjectiveQuestionCard.tsx`, `ExamInlineCodeLabSection.tsx`, `RuledA4Sheet.tsx`, `RealtimeMathPreview.tsx`, `realtime-math-preview.ts`, and `webmcp-essay-adapters.ts` (`100% Tự luận giấy A4` ↔ `Đề hỗn hợp`).
  - Synced 1-to-1 toolbar symbol & 95+ `\` shorthand parity (`math-shorthand.ts`, `math-symbols.ts` with empty `bySubject`/`byCourse`/`byChapter` presets) and `.hus-markdown` zero-specificity GFM table/list styling (`Markdown.tsx`, `index.css`).
- **Inline Multi-Step Exercises, `<ProblemFigure />` & Live Interactive Step Drafts**:
  - Synced `InlineSemiEssayExerciseCard.tsx`, `SemiEssayInteractiveSteps.tsx`, `ProblemFigure.tsx` + `problem-figure.ts` (`plot-2d` & 19 `physics-schematic` scenes), `interactive-step-drafts.ts`, `semi-essay-step-progress.ts`, and live draft persistence across all 9 diagram modules (`src/modules/diagrams/*.tsx`).
  - Synced declarative `studyMode?: 'default' | 'practice-only'` support across `learning.ts`, `progress.ts`, `LessonPage.tsx`, `CoursePage.tsx`, `CataloguePage.tsx`, `CoursesPage.tsx`, and `ProgressPage.tsx` (retaining `CataloguePage.tsx`'s zero-course template empty state).
- **Dual-Path Adaptive WebMCP & Permanent Zero-API-Key Policy**:
  - Synced `EssayWebMcpCoachPanel.tsx`, `curriculum-rag.ts` (including `summarizeExerciseVisualContext` and multi-statement Socratic anti-spoiler), `tutor-feedback-parser.ts` (LaTeX-safe JSON escape repair, Mức-1 `/10` grading, batch whole-exam import), and `webmcp-essay-bridge.ts` (retaining generic `https://your-domain.example` placeholder), plus `AGENTS.md`, `docs/SYSTEM_GUIDE.md`, and `docs/architecture/WRITTEN_PRACTICE.md`.
- **Verification**:
  - Added self-contained unit tests (`exam-practice-webmcp.test.ts`, `practice-only-courses.test.ts`, `problem-figure.test.ts`, `interactive-step-drafts.test.ts`, `visual-context-and-exam-store.test.ts`) and updated `workspace.spec.ts` to cover `/#/exams` across `360px`–`1440px`.
  - Verified with `npm run build` (`tsc --noEmit` + Vitest + Vite `dist/`) and `npm run test:e2e` (Desktop & Mobile Chromium).

---

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
