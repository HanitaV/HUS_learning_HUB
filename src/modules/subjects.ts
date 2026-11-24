import type { SubjectModule } from '../contracts/subject-module';

/**
 * Optional lazy subject tools, track modes, and celestial hero backdrops.
 *
 * Register one entry per `subjectId` defined in `src/content/subjects.ts`.
 * Heavy tool components MUST be lazy-loaded via `load: () => import(...)`.
 *
 * Example:
 * ```ts
 * export const subjectModules = [
 *   {
 *     subjectId: 'computer-science',
 *     trackMode: 'theory-first',
 *     practiceTrackLabel: 'Thực hành gõ code',
 *     theoryTrackLabel: 'Kiến thức & Thuật toán',
 *     defaultToolId: 'code-lab',
 *     tools: [
 *       {
 *         id: 'code-lab',
 *         title: 'Phòng thực hành Code (Python & Java WASM)',
 *         kind: 'code-lab',
 *         embedInExercises: true,
 *         load: () => import('./code-lab/CodeLabWorkspace'),
 *       },
 *     ],
 *   },
 * ] as const satisfies readonly SubjectModule[];
 * ```
 *
 * See `docs/ADDING_SUBJECTS_AND_CONTENT.md` for details.
 */
export const subjectModules: readonly SubjectModule[] = [];
