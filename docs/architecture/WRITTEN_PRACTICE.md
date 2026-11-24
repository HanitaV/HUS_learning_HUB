# Guided writing practice

`written-reasoning` extends the shared semi-essay step model. It provides authored hints, a model answer and process-specific review criteria. The learner writes first, explicitly reveals the reference, checks the criteria and submits a revised response. These actions record **self-review**, not an academic correctness result.

## Content & 65/65 Chapter Coverage

All 8 courses (`MAT1091`, `MAT1101`, `MAT3504`, `MAT3514`, `THCS4`, `OOP`, `PHY1159`, `CHE1080`) expose **90 source-backed written & hybrid essay exercises** (`928` total exercises across `308` lessons), covering **100% of all 65 chapters**. Questions come from verified lecture notes, textbook examples, or registered science/CS banks without inventing fake academic content or scores.

Each authored `src/content/courses/<course>/written-practice.ts` (and optional `semi-essays.ts`) exports a readonly semi-essay array. `withWrittenPractice` attaches exercises to known lessons, preserving existing exercise IDs and rejecting orphan/duplicate additions. Shared pages (`CoursePage`, `CourseAtlas`, `CourseDependencyGraph`, `LessonPage`, `ChapterExamPage`) surface written A4 practice and chapter exams generically without branching on subject names.

## Ruled A4 Sheet & Integrated Special-Character Input

`RuledA4Sheet` (`src/components/learning/RuledA4Sheet.tsx` + `src/styles/written-practice.css`) renders an exam-style ruled horizontal A4 folio (`--hus-a4-line: 2rem` synced with `background-attachment: local`, left margin line, light ivory `#fcfbf7` and dark nocturnal vellum `#0d1524`) with a docked flush `MathSymbolToolbar` (chapter/course/all scopes, `Unicode` / `Mathlib \` / `LaTeX` modes), `\` `MathSlashAutocomplete`, and a live KaTeX preview band at the foot of the sheet. It is shared across `WrittenReasoningStepView`, `ChemistryEssayLab`, and `ChapterExamPage`.

## Adaptive End-of-Chapter Exam (3–10 Questions)

`src/core/learning/chapter-exam.ts` (`summarizeChapterExamPool`, `buildChapterExamPaper`, `evaluateChapterExam`) generates deterministic seeded chapter exams between **3 and 10 questions** (`short` 3–4, `standard` 5–7, `comprehensive` 8–10, or exact user count clamped to `[min(3, pool), min(10, pool)]`). Selection guarantees at least one question per available exercise form (`semi-essay` on ruled A4 paper prioritized first, alongside `short-answer`, `multiple-answer`, and `multiple-choice`) and spreads evenly across lessons in the chapter. Sessions persist under `hus-learning-hub:chapter-exam:v1:<courseId>:<chapterId>` via `src/infrastructure/progress/chapter-exam-store.ts`. Objective items grade deterministically on submit, while A4 written items unlock model answers and rubric self-checks without fabricating prose scores.

## Drafts and outcomes

Drafts use a separate key `hus-learning-hub:written-draft:v1:<exerciseId>` with runtime-validated JSON. Initial response, revised response, reference visibility, reviewed criterion IDs and explicit submission are retained. Strings are bounded to 20,000 characters each. Unknown steps, malformed records and impossible submitted states are rejected. Corrupt saved data stays untouched until the learner explicitly restarts; blocked/quota-limited storage leaves current work in memory with a visible warning.

Changing the initial response hides the reference and invalidates its previous review, while retaining the learner's revised text. Changing the revision or review criteria also invalidates submission. Restart clears the activity's drafts. `PracticePage` keys the studio by exercise identity and writes a correct progress attempt only for the existing automatically graded flow. Self-review does not populate `correct: true` or alter progress v1.

## Interaction

Hints reveal progressively. A four-stage ribbon reflects actual writing/reference/revision/review state. Short CSS transitions indicate changes and honor `prefers-reduced-motion`. Visited steps retain their mounted inputs during navigation; unopened diagram components remain lazy. Source outlines and the learner's revisions are labelled separately.

## Limits

Written work is self-assessed; there is no AI, keyword or symbolic grading of prose. Saved drafts are local to this browser/origin, separate from the progress JSON backup and not synchronized across tabs/devices. Copy important writing before clearing browser data. Existing diagram/numeric checkpoints retain their own deterministic grading semantics. The content batch is selective, not a complete conversion of all problems in every course.
