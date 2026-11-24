import type { LearningContent, ProgressAction, ProgressState } from '../../domain/workspace';
import type { Course } from '../../domain/learning';
import { courseLessons } from './content';

export function emptyProgress(): ProgressState {
  return { schemaVersion: 1, completedLessonIds: [], bookmarkedResourceIds: [], recentTopics: [], attempts: [] };
}

const id = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 160;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const date = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 100000 && v.every(id) && new Set(v).size === v.length;

export function parseProgress(json: string): ProgressState {
  if (json.length > 5_000_000) throw new Error('Bản sao lưu quá lớn (tối đa 5 MB).');
  const v: unknown = JSON.parse(json);
  if (!record(v) || v.schemaVersion !== 1 || !ids(v.completedLessonIds) || !ids(v.bookmarkedResourceIds) ||
    !Array.isArray(v.recentTopics) || v.recentTopics.length > 20 || !Array.isArray(v.attempts) || v.attempts.length > 1000) throw new Error('Bản sao lưu không hợp lệ hoặc phiên bản chưa hỗ trợ.');
  const recentTopics: ProgressState['recentTopics'][number][] = [];
  for (const item of v.recentTopics) {
    if (!record(item) || !id(item.topicId) || !id(item.lessonId) || !id(item.courseId) || !date(item.at)) throw new Error('Lịch sử không hợp lệ.');
    recentTopics.push({ topicId: item.topicId, lessonId: item.lessonId, courseId: item.courseId, at: item.at });
  }
  if (new Set(recentTopics.map(t => t.topicId)).size !== recentTopics.length) throw new Error('Chủ đề trùng lặp.');
  const attempts: ProgressState['attempts'][number][] = [];
  for (const item of v.attempts) {
    if (!record(item) || !id(item.exerciseId) || typeof item.correct !== 'boolean' || !date(item.at)) throw new Error('Kết quả bài tập không hợp lệ.');
    attempts.push({ exerciseId: item.exerciseId, correct: item.correct, at: item.at });
  }
  return { schemaVersion: 1, completedLessonIds: [...v.completedLessonIds], bookmarkedResourceIds: [...v.bookmarkedResourceIds], recentTopics, attempts };
}

export function updateProgress(state: ProgressState, action: ProgressAction): ProgressState {
  switch (action.type) {
    case 'complete': return { ...state, completedLessonIds: action.completed ? [...new Set([...state.completedLessonIds, action.lessonId])] : state.completedLessonIds.filter(id => id !== action.lessonId) };
    case 'bookmark': return { ...state, bookmarkedResourceIds: state.bookmarkedResourceIds.includes(action.resourceId) ? state.bookmarkedResourceIds.filter(id => id !== action.resourceId) : [...state.bookmarkedResourceIds, action.resourceId] };
    case 'visit': return { ...state, recentTopics: [{ topicId: action.topicId, courseId: action.courseId, lessonId: action.lessonId, at: action.at }, ...state.recentTopics.filter(t => t.topicId !== action.topicId)].slice(0, 20) };
    case 'attempt': return { ...state, attempts: [...state.attempts, { exerciseId: action.exerciseId, correct: action.correct, at: action.at }].slice(-1000) };
  }
}

export function courseProgress(lessonIds: readonly string[], state: ProgressState): number {
  return lessonIds.length ? Math.round(100 * lessonIds.filter(id => state.completedLessonIds.includes(id)).length / lessonIds.length) : 0;
}

export function subjectProgress(content: LearningContent, courses: readonly Course[], subjectId: string, state: ProgressState): number {
  return courseProgress(courses.filter(c => c.subjectId === subjectId).flatMap(c => courseLessons(content, c).map(l => l.id)), state);
}
