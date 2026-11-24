# Adding Subjects, Courses & Content

This guide walks through every step required to add your own subjects, courses, lessons, exercises, guided written essays, interactive diagrams, and lazy subject tools to **HUS Learning Hub**.

The academic hierarchy is strictly normalized:

```text
Subject → Course → Chapter → Topic → Lesson → Exercise
```

All content is **auto-discovered at build time** via Vite `import.meta.glob` — you never need to edit router files or shared page components.

---

## Naming & Identity Rules

- Use stable **lowercase kebab-case IDs** (e.g., `mathematics`, `mat1091`, `mat1091-ch1`, `mat1091-limits`).
- Keep academic codes separate in `academicCode` (e.g., `'MAT1091'`).
- **Namespace** chapter, topic, lesson, and exercise IDs with their `courseId` prefix so IDs never collide across courses.
- Ordered ID arrays (`chapterIds`, `topicIds`, `lessonIds`, `exerciseIds`) define learning order.
- Keep all Vietnamese text and filenames in UTF-8.

---

## Step 1: Register a Subject

Edit [`src/content/subjects.ts`](../src/content/subjects.ts):

```ts
import type { Subject } from '../domain/learning';

export const subjects: readonly Subject[] = [
  { id: 'mathematics', title: 'Toán học' },
  { id: 'computer-science', title: 'Khoa học máy tính' },
];
```

Every `Course.subjectId` must match an `id` declared in `subjects`. The registry validator rejects unknown subject references at startup and during `npm run build`.

---

## Step 2: Create a Course Manifest (`course.ts`)

Create `src/content/courses/<course-id>/course.ts` with a **default export** satisfying `Course`:

```ts
import type { Course } from '../../../domain/learning';

const course: Course = {
  schemaVersion: 1,
  id: 'mat1091',
  academicCode: 'MAT1091',
  subjectId: 'mathematics',
  title: 'Giải tích 1',
  language: 'vi',
  status: 'available', // Use 'metadata-only' until chapters & lessons exist
  chapterIds: ['mat1091-ch1'],
  resourceIds: [],
  provenance: {
    repository: 'https://github.com/your-org/your-content-repo',
    revision: '0123456789abcdef0123456789abcdef01234567',
    path: 'courses/mat1091',
    rights: 'approved',
    attribution: 'Khoa Toán - Cơ - Tin học',
  },
};

export default course;
```

As soon as `course.ts` exists, the course automatically appears on `/` and `/#/courses`, and is accessible at `/#/courses/mat1091`.

---

## Step 3: Add Chapters, Topics, Lessons & Markdown

### 3.1 Create `content.ts`

Create `src/content/courses/<course-id>/content.ts` with a default export satisfying `LearningContent`:

```ts
import type { LearningContent } from '../../../domain/workspace';

const content: LearningContent = {
  chapters: [
    {
      id: 'mat1091-ch1',
      courseId: 'mat1091',
      title: 'Chương 1. Giới hạn và liên tục',
      topicIds: ['mat1091-t1'],
    },
  ],
  topics: [
    {
      id: 'mat1091-t1',
      chapterId: 'mat1091-ch1',
      title: 'Cận trên đúng và giới hạn dãy số',
      lessonIds: ['mat1091-supremum'],
    },
  ],
  lessons: [
    {
      id: 'mat1091-supremum',
      topicId: 'mat1091-t1',
      title: 'Cận trên đúng (sup) và cận dưới đúng (inf)',
      summary: 'Định nghĩa cận trên đúng, tính đầy đủ của tập số thực và ví dụ chứng minh.',
      content: {
        format: 'markdown',
        // Relative to `src/content/courses/`
        assetPath: 'mat1091/lessons/mat1091-supremum.md',
      },
      exerciseIds: ['mat1091-ex-1'],
      resourceIds: [],
    },
  ],
  exercises: [], // Keep empty here if using lazy `exercises.ts` (recommended)
  resources: [],
};

export default content;
```

### 3.2 Author the Lesson Markdown (`lessons/<lesson-id>.md`)

Create `src/content/courses/mat1091/lessons/mat1091-supremum.md`:

```markdown
# Cận trên đúng (sup) và cận dưới đúng (inf)

## 1. Định nghĩa

Cho tập khác rỗng $A \subset \mathbb{R}$. Số $M \in \mathbb{R}$ được gọi là **cận trên đúng** của $A$, ký hiệu $M = \sup A$, nếu:

1. $\forall x \in A,\; x \le M$.
2. $\forall \varepsilon > 0,\; \exists x \in A : x > M - \varepsilon$.

$$
\sup \left\{ \frac{n}{n+1} : n \in \mathbb{N}^* \right\} = 1
$$
```

- Inline math uses `$...$`, block math uses `$$...$$` (rendered safely with KaTeX).
- Raw HTML is not executed; use standard Markdown, tables, lists, blockquotes, and fenced code blocks.
- `validateContent` checks that every `lesson.content.assetPath` resolves to an actual `.md` file and that `prerequisiteLessonIds` form an acyclic DAG.

### 3.3 Adding Local PDF Assets (Optional)

Place redistribution-approved PDFs under `public/assets/<course-id>/<filename>.pdf` and reference them in `content.resources` with `assetPath: 'assets/<course-id>/<filename>.pdf'` (never a leading `/`) and 1-based `pages: [1, 2]`.

---

## Step 4: Add Objective Exercises (`exercises.ts`)

Create `src/content/courses/<course-id>/exercises.ts` with a default export of `readonly ExerciseDefinition[]`. Exercises in `exercises.ts` are **code-split and lazy-loaded** per course so the initial bundle stays small.

Supported objective kinds:
- `multiple-choice` (single correct `correctOptionId`)
- `multiple-answer` (multiple `correctOptionIds`)
- `short-answer` (`acceptedAnswers`, supports normalized math glyphs like `−`, `×`, `≤`, `≥`, `π`, `√`)

```ts
import type { ExerciseDefinition } from '../../../domain/workspace';

const exercises: readonly ExerciseDefinition[] = [
  {
    id: 'mat1091-ex-1',
    lessonId: 'mat1091-supremum',
    kind: 'multiple-choice',
    prompt: 'Giá trị $\\sup \\{1 - 1/n : n \\in \\mathbb{N}^*\\}$ bằng bao nhiêu?',
    options: [
      { id: 'a', label: '$0$' },
      { id: 'b', label: '$1$' },
      { id: 'c', label: '$+\\infty$' },
    ],
    correctOptionId: 'b',
    explanation: 'Với mọi $n \\ge 1$, $1 - 1/n < 1$ và tiến tới $1$ khi $n \\to \\infty$.',
  },
];

export default exercises;
```

Make sure every `exercise.id` is listed in its lesson's `exerciseIds` array in `content.ts`.

---

## Step 5: Add Guided Written Essays & Hybrid Diagram Exercises

Written practice banks are automatically discovered from:
- `src/content/courses/<course-id>/written-practice.ts` (default export `readonly SemiEssayExercise[]`)
- `src/content/courses/<course-id>/semi-essays.ts` (default or named export `readonly SemiEssayExercise[]`)

Each `SemiEssayExercise` (`kind: 'semi-essay'`) combines ordered steps (`written-reasoning`, `diagram`, `numeric-unit`, `axis-projection`) with theory anchors, key points, model answer reveal, rubric self-review, and grounded Socratic AI coaching.

### Available Interactive Diagram Kinds (`step.kind === 'diagram'`)

| Diagram `kind` | Typical Use Case |
| --- | --- |
| `fbd` | Free-body force diagrams (Physics mechanics) |
| `heatmap` | 2D scalar field / heat transfer inspection |
| `curve-2d` | 2D function curves, areas, rejection regions, $P\text{–}V$ cycles |
| `balance-flow` | Energy / mass / conservation balance bars (LOL charts, stoichiometry) |
| `mo-diagram` | Molecular orbital energy-level spin-filling diagram (Type I & II) |
| `prob-tree` | Probability partition tree & Bayes theorem branches |
| `algo-trace` | 1D/2D algorithm state trace & DP tables |
| `proof-dag` | Causal prerequisite DAG proof ordering |
| `parsons-flow` | Indentation-sensitive code block ordering |

See [`src/domain/semi-essay.ts`](../src/domain/semi-essay.ts) for the exact TypeScript interfaces of each step and diagram spec.

---

## Step 6: Search Index, Math Symbol Presets & AI Canons

### 6.1 Search Index (`search-index.ts`)

Create `src/content/courses/<course-id>/search-index.ts` exporting a map of `lessonId → searchable plain text` (accent-insensitive matching is handled automatically):

```ts
const searchIndex: Readonly<Record<string, string>> = {
  'mat1091-supremum': 'can tren dung can duoi dung sup inf tap so thuc chan tren',
};

export default searchIndex;
```

### 6.2 Math Symbol Toolbar Presets (`src/content/math-symbols.ts`)

`src/content/math-symbols.ts` already includes 95+ academic symbols and structured KaTeX templates. Optionally add streamlined presets under `bySubject`, `byCourse`, or `byChapter` using symbol IDs from `SYMBOLS`. If omitted, the toolbar automatically falls back to `fallbackIds`.

### 6.3 Course Convention Canons (`src/content/curriculum-canons.ts`)

Optionally add an entry under `COURSE_CONVENTION_CANONS[courseId]` to give the Socratic AI tutor and NotebookLM exporter course-specific notation rules, anti-shortcut warnings, and reasoning scaffold templates.

---

## Step 7: Optional Lazy Subject Tools, Code Lab & Skill Quests

### 7.1 Register Subject Modules (`src/modules/subjects.ts`)

Attach lazy-loaded interactive tools and optional celestial hero backdrops per `subjectId` in [`src/modules/subjects.ts`](../src/modules/subjects.ts). Shared pages never branch on subject names — everything is declarative:

- **WASM Code Lab (Python & Java)**: Register `load: () => import('./code-lab/CodeLabWorkspace')` with `embedInExercises: true` and add problems to [`src/content/code-lab/problems.ts`](../src/content/code-lab/problems.ts).
- **Parsons Studio**: Register `load: () => import('./blocks/ParsonsStudio')` and add exercises to [`src/content/blocks/parsons-bank.ts`](../src/content/blocks/parsons-bank.ts).
- **Proof Blocks Studio**: Register `load: () => import('./blocks/ProofBlocksStudio')` and add exercises to [`src/content/blocks/proof-bank.ts`](../src/content/blocks/proof-bank.ts).

### 7.2 Skill Quests & Lesson Animations

- **Skill Quests**: Create `src/content/quests/<subject>-quests.ts` with a default export of `readonly SkillQuest[]`. Auto-discovered by [`src/infrastructure/quests/registry.ts`](../src/infrastructure/quests/registry.ts).
- **Lesson Animations**: Create `src/content/animations/<course-id>.ts` with a default export of `Readonly<Record<string, LessonAnimationSpec>>` keyed by `lessonId`. Auto-discovered lazily by [`src/infrastructure/animations/loader.ts`](../src/infrastructure/animations/loader.ts).

---

## Step 8: Validate & Test

After adding content, run:

```sh
npm run build
npm run test:e2e
```

`npm run build` automatically validates:
1. Strict TypeScript types across all manifests and exercises.
2. Referential integrity (`course → chapter → topic → lesson → exercise`), unique IDs, no prerequisite cycles, and existence of every Markdown body and public asset.
3. Production bundle generation in `dist/`.
