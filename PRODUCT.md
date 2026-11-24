# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Undergraduate students at VNU University of Science (Trường Đại học Khoa học Tự nhiên, ĐHQGHN — VNU-HUS) studying Computer Science, Physics, and Chemistry, looking for a calm, reliable, open place to browse courses, read verified lectures with mathematical notation, practice self-graded exercises, and track their own study progress.

## Product Purpose

HUS Learning Hub unifies open learning materials, structured course syllabi, interactive subject tools, and verified academic source provenance for VNU-HUS into one static, free-to-operate web workspace. Success means a visitor immediately feels inspired by the spirit of natural science on the landing page, understands what is available today without exaggeration, and can jump straight into a course, lesson, or search query within seconds.

## Positioning

A static, zero-backend, local-first academic learning hub tailored specifically to VNU-HUS courses—combining verified open-license lecture notes (Markdown + KaTeX math + syntax-highlighted code), deterministic interactive visualizations, exact self-graded exercises, and transparent upstream source provenance, with progress saved privately in the browser and exportable as JSON.

## Operating Context

- Desktop and mobile browsers (360px to 1440px+), often used in libraries, lecture halls, and late-night study sessions (both daylight and dark environments).
- Deployed statically under a GitHub Pages repository subpath (`/HUS_Learning_Page/`) with HashRouter and relative Vite assets (`base: './'`).
- Zero external runtime CDNs, no backend, no user accounts, no cookies or tracking.

## Capabilities and Constraints

- 6 registered courses across 3 subjects: Khoa học máy tính (`MAT3504`, `MAT3514`, `THCS4`, `OOP`), Vật lý (`PHY1159`), and Hóa học (`general-chemistry`).
- `PHY1159` (Vật lý đại cương 1: Cơ – Nhiệt) has 2 full chapters, 5 real Markdown/KaTeX lessons, and 3 interactive self-graded exercises.
- The other 5 courses are honestly marked `metadata-only` (verified academic codes, titles, and immutable upstream provenance links; no fabricated chapters or lessons).
- 11 verified resource records with bookmarking and upstream links.
- 1 lazy-loaded interactive algorithm tool (`BubbleSortTool`) registered via `SubjectModule` on Computer Science courses.
- Local-first progress storage (`hus-learning-hub:progress:v1`) with validated JSON export/restore and graceful fallback when `localStorage` is blocked.
- Strict architectural boundaries: `src/domain` and `src/core` remain React-free and browser-free; shared pages never switch on subject names; all fonts and assets are self-hosted locally.
- Existing E2E test contracts (headings, landmarks, skip link, searchboxes, keyboard navigation, zero horizontal overflow across 360/390/768/1024/1440px) must remain passing.

## Brand Commitments

- Name: **HUS Learning Hub** (Trường Đại học Khoa học Tự nhiên, ĐHQGHN).
- Confirmed visual atmosphere: **Atmospheric Observatory (Bầu trời & Đài thiên văn học thuật)** — pure luminous daylight and deep nocturnal starlit sky, crisp orbital/celestial geometry, soft atmospheric light, and airy, poetic typography, with primary focus on making the Landing Page (`/`) feel soaring and ethereal while keeping inner study/reading surfaces calm, legible, and synchronized.
- Language: Vietnamese (`lang="vi"`), honest academic tone, no fabricated metrics, testimonials, or unverified availability claims.

## Evidence on Hand

- `src/content/courses/phy1159/lessons/*.md`: 5 real physics lessons with KaTeX math and exercises.
- `src/content/courses/*/course.ts`: 6 verified course manifests with immutable Git provenance.
- `src/modules/algorithms/BubbleSortTool.tsx`: deterministic sorting replay visualization.
- `src/assets/fonts/be-vietnam-pro-*.woff2`: locally bundled OFL Vietnamese UI typeface.
- Absence: No fabricated student counts, ratings, testimonials, or unmigrated course chapters may be invented.

## Product Principles

1. **Honesty over hype**: Show real courses, real lessons, and real provenance clearly; never invent numbers or fake availability.
2. **Ethereal arrival, focused study**: Let the Landing Page evoke the wonder of natural science and discovery; let course and lesson views recede into quiet, high-legibility focus.
3. **Local-first & zero-dependency runtime**: Every font, asset, and interactive state works statically under any subpath without external CDNs or servers.
4. **Universal keyboard & mobile craft**: Full WCAG 2.2 AA contrast, visible focus rings, skip link, reduced-motion respect, and zero horizontal overflow down to 360px.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast (≥4.5:1 body, ≥3:1 large text) in both light and dark modes.
- Full keyboard navigation, visible focus rings, working skip-to-content link, and `prefers-reduced-motion` support.
