import { lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { AppLayout } from './layouts/AppLayout';
import { preloadCataloguePage, preloadCoursesPage } from './route-transition';

const CataloguePage = lazy(preloadCataloguePage);
const CoursesPage = lazy(preloadCoursesPage);
const CoursePage = lazy(() => import('../pages/CoursePage'));
const ChapterExamPage = lazy(() => import('../pages/ChapterExamPage'));
const LessonPage = lazy(() => import('../pages/LessonPage'));
const PracticePage = lazy(() => import('../pages/PracticePage'));
const QuestPage = lazy(() => import('../pages/QuestPage'));
const ProgressPage = lazy(() => import('../pages/ProgressPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<CataloguePage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:courseId" element={<CoursePage />} />
            <Route path="courses/:courseId/chapters/:chapterId/exam" element={<ChapterExamPage />} />
            <Route path="courses/:courseId/lessons/:lessonId" element={<LessonPage />} />
            <Route path="courses/:courseId/lessons/:lessonId/practice/:exerciseId" element={<PracticePage />} />
            <Route path="quests/:questId" element={<QuestPage />} />
            <Route path="resources" element={<Navigate to="/" replace />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
