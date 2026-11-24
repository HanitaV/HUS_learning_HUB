# Guided writing practice

`written-reasoning` extends the shared semi-essay step model. It provides authored hints, a model answer and process-specific review criteria. The learner writes first, explicitly reveals the reference, checks the criteria and submits a revised response. These actions record **self-review**, not an academic correctness result.

## Content

The initial batch adds 12 real source-backed exercises: two in each of MAT3504, MAT3514, THCS4 and OOP, plus one each in MAT1091, MAT1101, PHY1159 and general chemistry. Questions come from existing self-checks, textbook examples or already registered science questions. No new examination questions or scores are invented. The two math courses now expose one actual source excerpt lesson apiece while preserving their full local PDFs.

Each authored `src/content/courses/<course>/written-practice.ts` exports a readonly semi-essay array. `withWrittenPractice` attaches exercises to known lessons, preserving existing exercise IDs and rejecting orphan/duplicate additions. The tiny bank index supplies course-page links; the shared page does not branch on subject names. Chemistry retains its lazy exercise bank and adds its written activity there, rather than copying the full bank eagerly.

The DSA, physics and chemistry importers preserve authored practice extensions when regenerated. Physics also retains the separate existing diagram-based semi-essay bank. Run the original import commands to reproduce migrated base content; authored practice remains a separate reviewed batch.

## Drafts and outcomes

Drafts use a separate key `hus-learning-hub:written-draft:v1:<exerciseId>` with runtime-validated JSON. Initial response, revised response, reference visibility, reviewed criterion IDs and explicit submission are retained. Strings are bounded to 20,000 characters each. Unknown steps, malformed records and impossible submitted states are rejected. Corrupt saved data stays untouched until the learner explicitly restarts; blocked/quota-limited storage leaves current work in memory with a visible warning.

Changing the initial response hides the reference and invalidates its previous review, while retaining the learner's revised text. Changing the revision or review criteria also invalidates submission. Restart clears the activity's drafts. `PracticePage` keys the studio by exercise identity and writes a correct progress attempt only for the existing automatically graded flow. Self-review does not populate `correct: true` or alter progress v1.

## Interaction

Hints reveal progressively. A four-stage ribbon reflects actual writing/reference/revision/review state. Short CSS transitions indicate changes and honor `prefers-reduced-motion`. Visited steps retain their mounted inputs during navigation; unopened diagram components remain lazy. Source outlines and the learner's revisions are labelled separately.

## Limits

Written work is self-assessed; there is no AI, keyword or symbolic grading of prose. Saved drafts are local to this browser/origin, separate from the progress JSON backup and not synchronized across tabs/devices. Copy important writing before clearing browser data. Existing diagram/numeric checkpoints retain their own deterministic grading semantics. The content batch is selective, not a complete conversion of all problems in every course.
