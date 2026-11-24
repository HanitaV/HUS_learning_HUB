import type { Subject } from '../domain/learning';

/**
 * Register academic subjects (faculties / disciplines) here.
 *
 * Example:
 * ```ts
 * export const subjects = [
 *   { id: 'mathematics', title: 'Toán học' },
 *   { id: 'computer-science', title: 'Khoa học máy tính' },
 * ] as const satisfies readonly Subject[];
 * ```
 *
 * See `docs/ADDING_SUBJECTS_AND_CONTENT.md` for the full authoring guide.
 */
export const subjects: readonly Subject[] = [];
