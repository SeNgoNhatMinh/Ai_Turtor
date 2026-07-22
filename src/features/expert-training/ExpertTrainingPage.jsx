import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Select, Space, Tabs, Tag, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AsyncState from '../../components/common/AsyncState';
import PageHeader from '../../components/common/PageHeader';
import ScopeBar from '../../components/common/ScopeBar';
import { getAccountRoleLabel } from '../../constants/roles';
import { isTutorV2HarnessEnabled } from '../ai-harness/expertTrainingGateway';
import ExpertTrainingOverview from './components/ExpertTrainingOverview';
import {
  getEvaluationReadiness,
} from './expertTrainingSelectors';
import { useExpertTrainingController } from './useExpertTrainingController';
import './ExpertTraining.css';

const ExpertWorkWorkspace = lazy(() => import('./components/ExpertWorkWorkspace'));
const ExpertContentReviewWorkspace = lazy(() => import('./components/ExpertContentReviewWorkspace'));
const EvaluationDashboard = lazy(() => import('./components/EvaluationDashboard'));

const { Text } = Typography;
const VALID_VIEWS = new Set(['overview', 'work', 'content', 'evaluation']);
const courseLabel = (course) => (
  course.name && course.name !== course.id ? `${course.id} · ${course.name}` : course.id
);

function SectionFallback() {
  return <AsyncState loading loadingLabel="Đang tải khu vực Tutor V2..." loadingRows={6} />;
}

export default function ExpertTrainingPage({
  currentUser,
  courseId: externalCourseId = '',
  setCourseId: setExternalCourseId,
  triggerToast,
}) {
  const [localCourseId, setLocalCourseId] = useState(externalCourseId);
  const [searchParams, setSearchParams] = useSearchParams();
  const courseId = externalCourseId || localCourseId;
  const requestedView = searchParams.get('view');
  const activeView = VALID_VIEWS.has(requestedView) ? requestedView : 'overview';
  const selectedTaskId = searchParams.get('task') || '';
  const selectedReviewId = searchParams.get('review') || '';
  const draftChapter = searchParams.get('chapter') || '';

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
  }, [setExternalCourseId]);

  const changeCourse = useCallback((nextCourseId) => {
    setCourseId(nextCourseId);
    setQueryState({ view: 'overview', task: null, review: null, chapter: null });
  }, [setCourseId, setQueryState]);

  const controller = useExpertTrainingController({
    currentUser,
    courseId,
    selectedTaskId,
    setCourseId,
    triggerToast,
  });
  const taskLoading = controller.loading.tasks;
  const tasks = controller.resources.tasks;
  const selectedTaskChapter = controller.selectedTask?.chapter || '';
  const loadTaskMaterialPreview = controller.loadTaskMaterialPreview;

  useEffect(() => {
    if (selectedTaskId && !taskLoading && tasks.length && !controller.selectedTask) {
      setQueryState({ task: null }, true);
    }
  }, [
    controller.selectedTask,
    selectedTaskId,
    setQueryState,
    taskLoading,
    tasks,
  ]);

  useEffect(() => {
    loadTaskMaterialPreview(selectedTaskChapter);
  }, [loadTaskMaterialPreview, selectedTaskChapter]);

  const selectTask = useCallback((task) => {
    setQueryState({ view: 'work', task: task?.id || null, chapter: null });
  }, [setQueryState]);

  const navigateToAction = useCallback((action) => {
    setQueryState({
      view: action.view || 'overview',
      task: action.taskId || null,
      review: action.reviewId || null,
    });
  }, [setQueryState]);

  const evaluationReadiness = useMemo(
    () => getEvaluationReadiness(controller.resources),
    [controller.resources],
  );

  const tabs = useMemo(() => [
    {
      key: 'overview',
      label: 'Tổng quan',
      children: (
        <ExpertTrainingOverview
          resources={controller.resources}
          loading={controller.loading}
          errors={controller.errors}
          canReview={controller.canReview}
          userId={controller.userId}
          pendingAction={controller.pendingAction}
          onAnalyzeCoverage={controller.analyzeCoverage}
          onRefreshCoverage={controller.loadGaps}
          chapterPreview={controller.chapterPreview}
          onRefreshChapters={controller.loadChapters}
          onConfirmChapters={controller.confirmChapterSelection}
          onAddManualChapter={controller.addManualChapter}
          onPreviewChapter={controller.openChapterPreview}
          onCloseChapterPreview={() => controller.setChapterPreview(null)}
          onCreateChapterTasks={controller.createTasksForChapter}
          onOpenMaterial={controller.openSourceMaterial}
          onNavigateAction={navigateToAction}
          onCreateTaskFromGap={(gap) => setQueryState({ view: 'work', chapter: gap.chapter })}
        />
      ),
    },
    {
      key: 'work',
      label: 'Công việc',
      children: (
        <Suspense fallback={<SectionFallback />}>
          <ExpertWorkWorkspace
            tasks={controller.resources.tasks}
            selectedTask={controller.selectedTask}
            draftChapter={draftChapter}
            userId={controller.userId}
            canReview={controller.canReview}
            loading={controller.loading}
            errors={controller.errors}
            pendingAction={controller.pendingAction}
            onRefreshTasks={controller.loadTasks}
            onClaimTask={controller.claimTask}
            onCreateTask={controller.createTask}
            onSelectTask={selectTask}
            onDraftConsumed={() => setQueryState({ chapter: null }, true)}
            onSubmitGoldQa={controller.submitGoldQa}
            onSubmitRubric={controller.submitRubric}
            taskMaterialPreview={controller.taskMaterialPreview}
            selectedTaskRejection={controller.selectedTaskRejection}
            onOpenMaterial={controller.openSourceMaterial}
          />
        </Suspense>
      ),
    },
    {
      key: 'content',
      label: controller.canReview && controller.pendingReviewCount
        ? `Nội dung & kiểm duyệt (${controller.pendingReviewCount})`
        : 'Nội dung & kiểm duyệt',
      children: (
        <Suspense fallback={<SectionFallback />}>
          <ExpertContentReviewWorkspace
            resources={controller.resources}
            userId={controller.userId}
            canReview={controller.canReview}
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
    {
      key: 'evaluation',
      label: 'Evaluation',
      children: (
        <Suspense fallback={<SectionFallback />}>
          <EvaluationDashboard
            runs={controller.resources.evalRuns}
            readiness={evaluationReadiness}
            canReview={controller.canReview}
            loading={controller.loading.evaluation}
            error={controller.errors.evaluation}
            pendingAction={controller.pendingAction}
            detail={controller.evaluationDetail}
            detailLoading={controller.evaluationDetailLoading}
            onRefresh={controller.loadEvaluation}
            onStart={controller.startEvaluation}
            onOpenDetail={controller.openEvaluationDetail}
            onCloseDetail={() => controller.setEvaluationDetail(null)}
          />
        </Suspense>
      ),
    },
  ], [
    controller,
    draftChapter,
    evaluationReadiness,
    navigateToAction,
    selectTask,
    selectedReviewId,
    setQueryState,
  ]);

  const connectionColor = controller.connectionState === 'CONNECTED'
    ? 'green'
    : controller.connectionState === 'RECONNECTING'
      ? 'orange'
      : 'default';
  const harnessEnabled = isTutorV2HarnessEnabled();

  return (
    <div className="expert-training-page">
      <PageHeader
        title="Huấn luyện tri thức AI"
        description="Biến thiếu hụt tri thức của môn học thành nội dung đã được kiểm duyệt và bộ Evaluation độc lập."
      />

      <ScopeBar
        actions={(
          <Button
            icon={<RefreshCw size={16} />}
            onClick={controller.refreshAll}
            disabled={!courseId}
            loading={Object.values(controller.loading).some(Boolean)}
          >
            Làm mới dữ liệu
          </Button>
        )}
      >
        <Select
          aria-label="Chọn môn học Tutor V2"
          showSearch
          optionFilterProp="label"
          value={courseId || undefined}
          placeholder="Chọn môn học"
          className="expert-training__course-select"
          loading={controller.loading.courses}
          onChange={changeCourse}
          options={controller.courses.map((course) => ({
            value: course.id,
            label: courseLabel(course),
          }))}
        />
        <Space wrap size={[6, 6]}>
          <Tag color="blue">{getAccountRoleLabel(controller.reviewerRole)}</Tag>
          <Tag color={harnessEnabled ? 'purple' : 'default'}>
            {harnessEnabled ? 'n8n Tutor V2' : 'Backend trực tiếp'}
          </Tag>
          <Tag color={connectionColor}>
            Realtime {controller.connectionState === 'CONNECTED' ? 'đã kết nối' : 'đang kết nối lại'}
          </Tag>
        </Space>
        <Text type="secondary" className="expert-training__canonical-note">
          REST API là nguồn dữ liệu chuẩn; WebSocket chỉ yêu cầu tải lại dữ liệu.
        </Text>
      </ScopeBar>

      <AsyncState
        loading={controller.loading.courses && !controller.courses.length}
        error={controller.errors.courses}
        empty={!controller.loading.courses && !controller.errors.courses && !controller.courses.length}
        emptyTitle="Chưa có môn học khả dụng"
        emptyDescription="Hãy tạo hoặc phân công môn học trước khi mở quy trình Tutor V2."
        onRetry={controller.loadCourses}
      >
        {courseId ? (
          <Tabs
            activeKey={activeView}
            onChange={(view) => setQueryState({ view })}
            items={tabs}
            className="expert-training__tabs"
          />
        ) : (
          <AsyncState
            empty
            emptyTitle="Chọn môn học để bắt đầu"
            emptyDescription="Mỗi môn học có thiếu hụt, task, nội dung kiểm duyệt và Evaluation riêng."
          />
        )}
      </AsyncState>
    </div>
  );
}
