import type { CourseConventionCanon, ReasoningScaffoldTemplate } from '../domain/curriculum-tutor';
import type { EntityId } from '../domain/learning';

export const DEFAULT_REASONING_SCAFFOLDS: readonly ReasoningScaffoldTemplate[] = [
  {
    id: 'general-structured-reasoning',
    label: 'Giả thiết → Cơ sở lý thuyết → Lập luận & Kết luận',
    description: 'Khung trình bày tự luận chuẩn cho mọi học phần khoa học tự nhiên.',
    template:
      '1. Tóm tắt giả thiết & ký hiệu:\n- Xét ..., ta có ...\n\n2. Cơ sở lý thuyết / Định lý / Định luật:\n- Áp dụng ..., ta được: $...$\n\n3. Biến đổi, kiểm tra điều kiện biên & Kết luận:\n- Suy ra $...$. Vậy ...',
  },
];

/**
 * Optional per-course notation rules, anti-shortcut warnings, and reasoning scaffolds
 * used by the grounded Socratic AI tutor and NotebookLM exporter.
 *
 * Add an entry keyed by `courseId` when authoring a new course.
 */
export const COURSE_CONVENTION_CANONS: Readonly<Record<string, CourseConventionCanon>> = {};

export function resolveCourseConventionCanon(params: {
  readonly courseId: EntityId;
  readonly academicCode?: string | undefined;
  readonly subjectId: EntityId;
  readonly courseTitle: string;
}): CourseConventionCanon {
  const direct = COURSE_CONVENTION_CANONS[params.courseId];
  if (direct) return direct;
  return {
    courseId: params.courseId,
    academicCode: params.academicCode ?? params.courseId.toUpperCase(),
    subjectId: params.subjectId,
    courseTitle: params.courseTitle,
    notationRules: [
      'Bám sát định nghĩa, ký hiệu và điều kiện áp dụng được trình bày trực tiếp trong bài học hiện tại.',
    ],
    forbiddenShortcutHints: [
      'Không sử dụng định lý hoặc công cụ thuộc các chương phía sau chưa học trong đề cương.',
    ],
    reasoningScaffolds: DEFAULT_REASONING_SCAFFOLDS,
  };
}
