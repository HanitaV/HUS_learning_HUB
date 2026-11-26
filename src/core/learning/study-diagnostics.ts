import type { TutorAssessmentVerdict, TutorCoachingFeedback } from '../../domain/curriculum-tutor';
import type { Course, EntityId, Lesson } from '../../domain/learning';
import type { LearningContent, ProgressState } from '../../domain/workspace';
import { courseLessons } from './content';
import { courseEffectiveProgress } from './progress';
import { formatScoreVi } from './webmcp-essay-adapters';

export interface StoredTutorExerciseRecord {
  readonly exerciseId: EntityId;
  readonly byStepId: Readonly<Record<string, TutorCoachingFeedback>>;
}

export interface ExerciseMetadataLookup {
  readonly exerciseId: EntityId;
  readonly title: string;
  readonly courseId: EntityId;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly lessonId: EntityId;
  readonly lessonTitle: string;
}

export function buildExerciseMetadataLookup(params: {
  readonly courses: readonly Course[];
  readonly content: LearningContent;
  readonly exercises?: readonly { readonly id: EntityId; readonly lessonId: EntityId; readonly title: string }[] | undefined;
}): ReadonlyMap<EntityId, ExerciseMetadataLookup> {
  const { courses, content, exercises = [] } = params;
  const courseByLessonId = new Map<EntityId, Course>();
  for (const course of courses) {
    for (const lesson of courseLessons(content, course)) {
      courseByLessonId.set(lesson.id, course);
    }
  }
  const lessonById = new Map(content.lessons.map(l => [l.id, l]));
  const map = new Map<EntityId, ExerciseMetadataLookup>();

  for (const lesson of content.lessons) {
    const course = courseByLessonId.get(lesson.id);
    if (!course) continue;
    const courseCode = course.academicCode ?? course.id.toUpperCase();
    for (const exId of lesson.exerciseIds) {
      map.set(exId, {
        exerciseId: exId,
        title: exId,
        courseId: course.id,
        courseCode,
        courseTitle: course.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
      });
    }
  }

  for (const ex of exercises) {
    const lesson = lessonById.get(ex.lessonId);
    const course = courseByLessonId.get(ex.lessonId);
    if (!course) continue;
    map.set(ex.id, {
      exerciseId: ex.id,
      title: ex.title,
      courseId: course.id,
      courseCode: course.academicCode ?? course.id.toUpperCase(),
      courseTitle: course.title,
      lessonId: ex.lessonId,
      lessonTitle: lesson?.title ?? ex.lessonId,
    });
  }

  return map;
}

export interface MistakeLedgerEntry {
  readonly exerciseId: EntityId;
  readonly exerciseTitle: string;
  readonly courseId: EntityId;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly lessonId: EntityId;
  readonly lessonTitle: string;
  readonly stepId: string;
  readonly verdict?: TutorAssessmentVerdict | undefined;
  readonly score?: number | undefined;
  readonly maxScore?: number | undefined;
  readonly summary: string;
  readonly conventionWarnings: readonly string[];
  readonly socraticQuestions: readonly string[];
  readonly receivedAt: string;
}

export interface RecurringConventionWarning {
  readonly warning: string;
  readonly count: number;
  readonly courseCodes: readonly string[];
  readonly exerciseIds: readonly EntityId[];
}

export interface CourseDiagnosticSummary {
  readonly courseId: EntityId;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly completionPercent: number;
  readonly coachedCount: number;
  readonly passedCount: number;
  readonly notPassCount: number;
  readonly averageScoreOn10: number | null;
  readonly weakExerciseIds: readonly EntityId[];
}

export interface StudyDiagnosticsReport {
  readonly generatedAt: string;
  readonly totalCoachedSteps: number;
  readonly totalPassedSteps: number;
  readonly totalNotPassSteps: number;
  readonly mistakeEntries: readonly MistakeLedgerEntry[];
  readonly topConventionWarnings: readonly RecurringConventionWarning[];
  readonly weakExerciseIdsByCourse: Readonly<Record<EntityId, readonly EntityId[]>>;
  readonly courseSummaries: readonly CourseDiagnosticSummary[];
}

function normalizeWarningKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function buildStudyDiagnosticsReport(params: {
  readonly courses: readonly Course[];
  readonly content: LearningContent;
  readonly progress: ProgressState;
  readonly tutorRecords: readonly StoredTutorExerciseRecord[];
  readonly exerciseLookup: ReadonlyMap<EntityId, ExerciseMetadataLookup>;
  readonly nowIso?: string | undefined;
}): StudyDiagnosticsReport {
  const { courses, content, progress, tutorRecords, exerciseLookup } = params;

  const mistakeEntries: MistakeLedgerEntry[] = [];
  const warningBuckets = new Map<
    string,
    {
      readonly displayText: string;
      count: number;
      readonly courseCodes: Set<string>;
      readonly exerciseIds: Set<EntityId>;
    }
  >();

  const courseStats = new Map<
    EntityId,
    {
      coached: number;
      passed: number;
      notPass: number;
      scoreSum: number;
      scoreCount: number;
      readonly weakIds: Set<EntityId>;
    }
  >();

  for (const course of courses) {
    courseStats.set(course.id, {
      coached: 0,
      passed: 0,
      notPass: 0,
      scoreSum: 0,
      scoreCount: 0,
      weakIds: new Set(),
    });
  }

  let totalCoachedSteps = 0;
  let totalPassedSteps = 0;
  let totalNotPassSteps = 0;

  for (const record of tutorRecords) {
    const meta = exerciseLookup.get(record.exerciseId);
    const courseId = meta?.courseId ?? 'unknown';
    const courseCode = meta?.courseCode ?? courseId.toUpperCase();
    const courseTitle = meta?.courseTitle ?? courseId;
    const stats = courseStats.get(courseId);

    for (const fb of Object.values(record.byStepId)) {
      totalCoachedSteps += 1;
      if (stats) stats.coached += 1;

      if (typeof fb.score === 'number') {
        const maxScore = fb.maxScore && fb.maxScore > 0 ? fb.maxScore : 10;
        const normalized10 = (fb.score / maxScore) * 10;
        if (stats) {
          stats.scoreSum += normalized10;
          stats.scoreCount += 1;
        }
      }

      if (fb.verdict === 'pass') {
        totalPassedSteps += 1;
        if (stats) stats.passed += 1;
      } else if (fb.verdict === 'not-pass') {
        totalNotPassSteps += 1;
        if (stats) {
          stats.notPass += 1;
          stats.weakIds.add(record.exerciseId);
        }
      }

      for (const warn of fb.conventionWarnings) {
        const key = normalizeWarningKey(warn);
        if (!key) continue;
        let bucket = warningBuckets.get(key);
        if (!bucket) {
          bucket = {
            displayText: warn.trim(),
            count: 0,
            courseCodes: new Set(),
            exerciseIds: new Set(),
          };
          warningBuckets.set(key, bucket);
        }
        bucket.count += 1;
        bucket.courseCodes.add(courseCode);
        bucket.exerciseIds.add(record.exerciseId);
      }

      if (fb.verdict === 'not-pass' || fb.conventionWarnings.length > 0) {
        mistakeEntries.push({
          exerciseId: record.exerciseId,
          exerciseTitle: meta?.title ?? record.exerciseId,
          courseId,
          courseCode,
          courseTitle,
          lessonId: meta?.lessonId ?? '',
          lessonTitle: meta?.lessonTitle ?? '',
          stepId: fb.stepId,
          ...(fb.verdict !== undefined ? { verdict: fb.verdict } : {}),
          ...(fb.score !== undefined ? { score: fb.score } : {}),
          ...(fb.maxScore !== undefined ? { maxScore: fb.maxScore } : {}),
          summary: fb.summary,
          conventionWarnings: fb.conventionWarnings,
          socraticQuestions: fb.socraticQuestions,
          receivedAt: fb.receivedAt,
        });
      }
    }
  }

  // Also include exercises with failed progress attempts where no coaching pass exists
  const passedProgressSet = new Set(progress.attempts.filter(a => a.correct).map(a => a.exerciseId));
  for (const attempt of progress.attempts) {
    if (attempt.correct || passedProgressSet.has(attempt.exerciseId)) continue;
    const meta = exerciseLookup.get(attempt.exerciseId);
    if (!meta) continue;
    courseStats.get(meta.courseId)?.weakIds.add(attempt.exerciseId);
  }

  mistakeEntries.sort((a, b) => {
    const aFail = a.verdict === 'not-pass' ? 0 : 1;
    const bFail = b.verdict === 'not-pass' ? 0 : 1;
    if (aFail !== bFail) return aFail - bFail;
    return Date.parse(b.receivedAt || '0') - Date.parse(a.receivedAt || '0');
  });

  const topConventionWarnings: RecurringConventionWarning[] = [...warningBuckets.values()]
    .sort((a, b) => b.count - a.count || a.displayText.localeCompare(b.displayText, 'vi'))
    .slice(0, 12)
    .map(b => ({
      warning: b.displayText,
      count: b.count,
      courseCodes: [...b.courseCodes],
      exerciseIds: [...b.exerciseIds],
    }));

  const weakExerciseIdsByCourse: Record<EntityId, readonly EntityId[]> = {};
  const courseSummaries: CourseDiagnosticSummary[] = [];

  for (const course of courses) {
    const lessons: readonly Lesson[] = courseLessons(content, course);
    const completionPercent = courseEffectiveProgress(course, lessons, progress);
    const stats = courseStats.get(course.id);
    const weakIds = stats ? [...stats.weakIds] : [];
    if (weakIds.length > 0) {
      weakExerciseIdsByCourse[course.id] = weakIds;
    }
    courseSummaries.push({
      courseId: course.id,
      courseCode: course.academicCode ?? course.id.toUpperCase(),
      courseTitle: course.title,
      completionPercent,
      coachedCount: stats?.coached ?? 0,
      passedCount: stats?.passed ?? 0,
      notPassCount: stats?.notPass ?? 0,
      averageScoreOn10:
        stats && stats.scoreCount > 0
          ? Math.round((stats.scoreSum / stats.scoreCount) * 100) / 100
          : null,
      weakExerciseIds: weakIds,
    });
  }

  return {
    generatedAt: params.nowIso ?? new Date().toISOString(),
    totalCoachedSteps,
    totalPassedSteps,
    totalNotPassSteps,
    mistakeEntries,
    topConventionWarnings,
    weakExerciseIdsByCourse,
    courseSummaries,
  };
}

/**
 * Formats a clean Markdown Mistake & Convention Ledger ready for NotebookLM or Gemini Gems.
 */
export function formatMistakeLedgerMarkdown(
  report: StudyDiagnosticsReport,
  options?: { readonly courseId?: EntityId | undefined; readonly courseLabel?: string | undefined },
): string {
  const filteredEntries = options?.courseId
    ? report.mistakeEntries.filter(e => e.courseId === options.courseId)
    : report.mistakeEntries;

  const heading = options?.courseLabel
    ? `# Sổ tay Lỗi sai & Ký hiệu ĐHKHTN: ${options.courseLabel}`
    : '# Sổ tay Lỗi sai & Ký hiệu ĐHKHTN (Tổng hợp đa học phần)';

  const lines: string[] = [
    heading,
    '',
    `- **Ngày xuất:** ${report.generatedAt.slice(0, 10)}`,
    `- **Tổng mục cần ôn lại:** ${filteredEntries.length} bài tập`,
    `- **Mục đích:** Nạp vào Google NotebookLM / Gemini để tạo bài ôn tập tập trung đúng các lỗi ký hiệu, điều kiện định lý và bước giải còn thiếu.`,
    '',
  ];

  if (!options?.courseId && report.topConventionWarnings.length > 0) {
    lines.push('## 1. Các lỗi ký hiệu & điều kiện lặp lại nhiều nhất');
    lines.push('');
    for (const item of report.topConventionWarnings) {
      lines.push(
        `- **[${item.count} lần · ${item.courseCodes.join(', ')}]** ${item.warning}`,
      );
    }
    lines.push('');
  }

  lines.push(
    options?.courseId
      ? '## Danh sách câu cần rèn lại & lưu ý trình bày'
      : '## 2. Chi tiết từng câu chưa đạt hoặc có cảnh báo trình bày',
  );
  lines.push('');

  if (filteredEntries.length === 0) {
    lines.push('Hiện chưa ghi nhận lỗi sai hay cảnh báo ký hiệu nào cần ôn lại trong phạm vi này.');
    return lines.join('\n') + '\n';
  }

  filteredEntries.forEach((entry, idx) => {
    const scorePart =
      typeof entry.score === 'number'
        ? `${formatScoreVi(entry.score)}/${entry.maxScore ?? 10}`
        : 'Chưa chấm điểm';
    const verdictLabel =
      entry.verdict === 'not-pass'
        ? 'CHƯA ĐẠT (Mức 1)'
        : entry.verdict === 'pass'
          ? 'ĐẠT (có lưu ý trình bày)'
          : 'Gợi mở Socratic';

    lines.push(`### ${idx + 1}. [${entry.courseCode}] ${entry.exerciseTitle}`);
    lines.push(`- **Trạng thái:** ${verdictLabel} · **Điểm:** ${scorePart}`);
    if (entry.lessonTitle) {
      lines.push(`- **Bài học liên quan:** ${entry.lessonTitle}`);
    }
    lines.push(`- **Nhận xét tổng quan:** ${entry.summary}`);
    if (entry.conventionWarnings.length > 0) {
      lines.push('- **Lỗi điều kiện / ký hiệu cần tránh:**');
      for (const warn of entry.conventionWarnings) {
        lines.push(`  - ${warn}`);
      }
    }
    if (entry.socraticQuestions.length > 0) {
      lines.push('- **Câu hỏi tự kiểm tra trước khi làm lại:**');
      for (const q of entry.socraticQuestions) {
        lines.push(`  - ${q}`);
      }
    }
    lines.push('');
  });

  return lines.join('\n').trim() + '\n';
}
