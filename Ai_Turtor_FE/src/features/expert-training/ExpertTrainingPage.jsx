import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Select } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AsyncState from '../../components/common/AsyncState';
import ActionButton from '../../components/common/ActionButton';
import PageHeader from '../../components/common/PageHeader';
import ScopeBar from '../../components/common/ScopeBar';
import AppTabs from '../../components/common/AppTabs';
import ChapterCoveragePanel from './components/ChapterCoveragePanel';
import { defaultExpertTaskDueAt } from './expertTrainingUtils';
import { useExpertTrainingController } from './useExpertTrainingController';
import './ExpertTraining.css';

const SeniorReviewQueue = lazy(() => import('./components/SeniorReviewQueue'));
const SeniorTaskManagement = lazy(() => import('./components/SeniorTaskManagement'));
const VALID_TABS = new Set(['coverage', 'tasks', 'review']);

function SectionFallback() {
  return <AsyncState loading loadingLabel="Đang tải huấn luyện AI..." loadingRows={6} />;
}

const courseLabel = (course) => (
  course.name && course.name !== course.id ? `${course.id} · ${course.name}` : course.id
);

export default function ExpertTrainingPage({
  currentUser,
  courseId: externalCourseId = '',
  setCourseId: setExternalCourseId,
  triggerToast,
  workspaceMode = 'senior',
}) {
  const [localCourseId, setLocalCourseId] = useState(externalCourseId);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCourseId = searchParams.get('courseId') || '';
  const courseId = queryCourseId || externalCourseId || localCourseId;
  const requestedTab = searchParams.get('tab');
  const legacyView = searchParams.get('view');
  const selectedReviewId = searchParams.get('review') || '';
  const activeTab = VALID_TABS.has(requestedTab)
    ? requestedTab
    : legacyView === 'evaluation' || legacyView === 'content'
      ? 'review'
      : 'coverage';

  const setQueryState = useCallback((updates, replace = false) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value == null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, { replace });
  }, [setSearchParams]);

  const setCourseId = useCallback((nextCourseId) => {
    setLocalCourseId(nextCourseId);
    setExternalCourseId?.(nextCourseId);
    setQueryState({ courseId: nextCourseId || null, review: null, view: null }, true);
  }, [setExternalCourseId, setQueryState]);

  const controller = useExpertTrainingController({
    currentUser,
    courseId,
    setCourseId,
    triggerToast,
    mode: 'reviewer',
  });

  useEffect(() => {
    if (!VALID_TABS.has(requestedTab) || legacyView) {
      setQueryState({ tab: activeTab, view: null }, true);
    }
  }, [activeTab, legacyView, requestedTab, setQueryState]);

  const startChapter = useCallback((chapterTitle) => controller.startChapter(chapterTitle, {
    questionCount: 2,
    dueAt: defaultExpertTaskDueAt(7),
  }), [controller]);

  const tabs = [
    {
      key: 'coverage',
      label: 'Mục lục',
      children: (
        <ChapterCoveragePanel
          courseId={courseId}
          chapters={controller.resources.chapters}
          tasks={controller.resources.tasks}
          goldQa={controller.resources.goldQa}
          loading={controller.loading.chapters}
          error={controller.errors.chapters}
          canReview
          pendingAction={controller.pendingAction}
          chapterPreview={controller.chapterPreview}
          chapterPreviewLoading={controller.loading.chapterPreview}
          chapterPreviewError={controller.errors.chapterPreview}
          onRefresh={controller.loadChapters}
          onForceRefresh={controller.refreshChapters}
          onClosePreview={() => controller.setChapterPreview(null)}
          onOpenPreview={(chapter) => controller.openChapterPreview(chapter, true)}
          onStartChapter={startChapter}
          onOpenMaterial={controller.openSourceMaterial}
          onIgnoreChapter={controller.ignoreChapter}
          onOpenExam={() => setQueryState({ tab: 'review' })}
        />
      ),
    },
    {
      key: 'tasks',
      label: 'Quản lý task',
      children: (
        <Suspense fallback={<SectionFallback />}>
          <SeniorTaskManagement
            courseId={courseId}
            chapters={controller.resources.chapters}
            currentUser={currentUser}
            triggerToast={triggerToast}
          />
        </Suspense>
      ),
    },
    {
      key: 'review',
      label: controller.pendingReviewCount ? `Bài thi (${controller.pendingReviewCount})` : 'Bài thi',
      children: (
        <Suspense fallback={<SectionFallback />}>
          <SeniorReviewQueue
            goldQa={controller.resources.goldQa}
            rubrics={[]}
            selectedReviewId={selectedReviewId}
            loading={controller.loading.contributions}
            error={controller.errors.contributions}
            pendingAction={controller.pendingAction}
            onSelectReview={(id) => setQueryState({ review: id || null }, true)}
            onRefresh={controller.loadContributions}
            onReviewGoldQa={controller.reviewGoldQa}
            onReviewRubric={controller.reviewRubric}
          />
        </Suspense>
      ),
    },
  ];

  return (
    <div className="portal-section expert-training-page expert-training-page--reviewer">
      <PageHeader
        eyebrow={workspaceMode === 'admin' ? 'Giám sát AI' : 'Huấn luyện AI'}
        title={workspaceMode === 'admin' ? 'Huấn luyện AI Tutor' : 'Huấn luyện AI theo giáo trình'}
        description="Chọn chương → Teacher soạn tóm tắt + Thi lại (xem trước câu SV) → Senior chỉ duyệt nạp TRAINING vào RAG."
      />

      <ScopeBar
        actions={(
          <ActionButton
            icon={<RefreshCw size={16} />}
            onClick={controller.refreshAll}
            disabled={!courseId}
            loading={controller.loading.courses || controller.loading.chapters}
          >
            Làm mới
          </ActionButton>
        )}
      >
        <Select
          aria-label="Chọn môn học"
          showSearch
          optionFilterProp="label"
          value={courseId || undefined}
          placeholder="Chọn môn học"
          className="expert-training__course-select"
          loading={controller.loading.courses}
          onChange={setCourseId}
          options={controller.courses.map((course) => ({
            value: course.id,
            label: courseLabel(course),
          }))}
        />
      </ScopeBar>

      <AsyncState
        loading={controller.loading.courses && !controller.courses.length}
        error={controller.errors.courses}
        empty={!controller.loading.courses && !controller.errors.courses && !controller.courses.length}
        emptyTitle="Chưa có môn học khả dụng"
        emptyDescription="Tạo môn học và index giáo trình trước khi huấn luyện AI."
        onRetry={controller.loadCourses}
      >
        {courseId ? (
          <AppTabs
            activeKey={activeTab}
            onChange={(tab) => setQueryState({ tab, review: null })}
            items={tabs}
            className="expert-training__tabs"
          />
        ) : (
          <AsyncState
            empty
            emptyTitle="Chọn môn học để bắt đầu"
            emptyDescription="Mục lục sách và bài thi được tách theo từng môn."
          />
        )}
      </AsyncState>
    </div>
  );
}
