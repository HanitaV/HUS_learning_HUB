import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { courseRegistry } from '../infrastructure/content/catalogue';
import { learningContent } from '../infrastructure/content/learning';
import { getSkillQuest } from '../infrastructure/quests/registry';
import { progressStore } from '../infrastructure/progress/store';
import { SkillQuestStudio } from '../modules/quests/SkillQuestStudio';
import { Badge } from '../components/ui/Badge';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { ArrowLeftIcon, ClockIcon } from '../components/ui/Icons';

export default function QuestPage() {
  const { questId } = useParams();
  const quest = getSkillQuest(questId ?? '');
  const course = quest ? courseRegistry.get(quest.courseId) : undefined;
  const lesson = quest
    ? learningContent.lessons.find(item => item.id === quest.lessonId)
    : undefined;

  useEffect(() => {
    if (!quest || !lesson) {
      return;
    }
    progressStore.dispatch({
      type: 'visit',
      topicId: lesson.topicId,
      lessonId: quest.lessonId,
      courseId: quest.courseId,
      at: new Date().toISOString(),
    });
  }, [quest, lesson]);

  if (!quest) {
    return (
      <div className="max-w-xl space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Tổng quan', to: '/' },
            { label: 'Không tìm thấy nhiệm vụ' },
          ]}
        />
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <h1 className="text-2xl font-semibold text-ink">Không tìm thấy nhiệm vụ tương tác</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Nhiệm vụ bạn đang truy cập không tồn tại hoặc đã được thay đổi mã định danh.
          </p>
          <Link to="/" className="hus-btn hus-btn-secondary mt-5 !no-underline">
            <ArrowLeftIcon width={15} height={15} />
            Về Vũ trụ Mục tiêu
          </Link>
        </div>
      </div>
    );
  }

  const courseTitle = course?.title ?? quest.courseId;
  const courseCode = course?.academicCode ?? quest.courseId.toUpperCase();

  return (
    <div className="mx-auto max-w-4xl min-w-0 space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Tổng quan', to: '/' },
          { label: courseTitle, to: `/courses/${quest.courseId}` },
          { label: quest.title },
        ]}
      />

      <header className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" mono>
            {courseCode}
          </Badge>
          <Badge tone="neutral">
            <ClockIcon width={12} height={12} />
            <span>~{quest.estimatedMinutes} phút</span>
          </Badge>
          <Badge tone="neutral">{quest.categoryLabel}</Badge>
        </div>

        <h1 className="mt-3 text-2xl font-semibold leading-tight text-ink sm:text-[1.75rem]">
          {quest.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{quest.subtitle}</p>
      </header>

      <SkillQuestStudio key={quest.id} quest={quest} courseTitle={courseTitle} courseCode={courseCode} />
    </div>
  );
}
