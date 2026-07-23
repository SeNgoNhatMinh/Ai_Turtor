import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Select, Space, Tabs, Tag, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AsyncState from '../../components/common/AsyncState';
import PageHeader from '../../components/common/PageHeader';
import ScopeBar from '../../components/common/ScopeBar';
import { getAccountRoleLabel } from '../../constants/roles';
import { isTutorV2HarnessEnabled } from '../ai-harness/expertTrainingGateway';
import ChapterCoveragePanel from './components/ChapterCoveragePanel';
import CoverageDashboard from './components/CoverageDashboard';
import { getEvaluationReadiness } from './expertTrainingSelectors';
import { useExpertTrainingController } from './useExpertTrainingController';
import './ExpertTraining.css';

const SeniorReviewQueue = lazy(() => import('./components/SeniorReviewQueue'));
const EvaluationDashboard = lazy(() => import('./components/EvaluationDashboard'));
const { Text } = Typography;
const VALID_TABS = new Set(['coverage', 'review', 'evaluation']);

function SectionFallback() {
  return <AsyncState loading loadingLabel="Đang tải khu vực Tutor V2..." loadingRows={6} />;
}

const courseLabel = (course) => (
  course.name && course.name !== course.id ? `${course.id} · ${course.name}` : course.id
);

export default function ExpertTrainingPage({
  currentUser,
  courseId: externalCourseId = '',
  setCourseId: setExternalCourseId,
  triggerToast,
}) {
  const [localCourseId, setLocalCourseId] = useState(externalCourseId);
  const [selectedChapterKeys, setSelectedChapterKeys] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCourseId = searchParams.get('courseId') || '';
  const courseId = queryCourseId || externalCourseId || localCourseId;
  const requestedTab = searchParams.get('tab');
  const legacyView = searchParams.get('view');
  const selectedReviewId = searchParams.get('review') || '';
  const activeTab = VALID_TABS.has(requestedTab)
    ? requestedTab
    : legacyView === 'content'
      ? 'review'
      : legacyView === 'evaluation'
        ? 'evaluation'
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
    setSelectedChapterKeys([]);
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

  const selectedChapterTitles = useMemo(() => {
    const selected = new Set(selectedChapterKeys);
    return controller.resources.chapters
      .filter((chapter) => selected.has(chapter.chapterKey || chapter.id))
      .map((chapter) => chapter.title);
  }, [controller.resources.chapters, selectedChapterKeys]);

  const evaluationReadiness = useMemo(
    () => getEvaluationReadiness(controller.resources),
    [controller.resources],
  );

  const createTasksFromGap = useCallback((gap) => controller.createTasksForChapter(gap.chapter, {
    includeTrainingGoldTask: true,
    includeEvaluationGoldTask: true,
  }), [controller]);

  const tabs = [
    {
      key: 'coverage',
      label: 'Coverage',
      children: (
        <div className="expert-training__hub-stack">
          <ChapterCoveragePanel
            chapters={controller.resources.chapters}
            loading={controller.loading.chapters}
            error={controller.errors.chapters}
            canReview
            pendingAction={controller.pendingAction}
            preview={controller.chapterPreview}
            previewLoading={controller.loading.chapterPreview}
            previewError={controller.errors.chapterPreview}
            onRefresh={controller.loadChapters}
            onConfirm={controller.confirmChapterSelection}
            onAddManual={controller.addManualChapter}
            onPreview={controller.openChapterPreview}
            onClosePreview={() => controller.setChapterPreview(null)}
            onCreateTasks={controller.createTasksForChapter}
            onOpenMaterial={controller.openSourceMaterial}
            onSelectionChange={setSelectedChapterKeys}
          />
          <CoverageDashboard
            gaps={controller.resources.gaps}
            chapters={controller.resources.chapters}
            selectedChapters={selectedChapterTitles}
            loading={controller.loading.gaps}
            error={controller.errors.gaps}
            canReview
            pendingAction={controller.pendingAction}
            onAnalyze={controller.analyzeCoverage}
            onRefresh={controller.loadGaps}
            onCreateTaskFromGap={createTasksFromGap}
          />
        </div>
      ),
    },
    {
      key: 'review',
      label: controller.pendingReviewCount
        ? `Duyệt (${controller.pendingReviewCount})`
        : 'Duyệt',
      children: (
        <Suspense fallback={<SectionFallback />}>
          <SeniorReviewQueue
            goldQa={controller.resources.goldQa}
            rubrics={controller.resources.rubrics}
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
            canReview
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
  ];

  const connectionColor = controller.connectionState === 'CONNECTED' ? 'green' : 'orange';
  const harnessEnabled = isTutorV2HarnessEnabled();

  return (
    <div className="expert-training-page">
      <PageHeader
        title="Expert Co-Training V2"
        description="Xác nhận độ phủ học liệu, kiểm duyệt tri thức và đánh giá AI Tutor bằng holdout độc lập."
      />

      <ScopeBar
        actions={(
          <Button
            icon={<RefreshCw size={16} />}
            onClick={controller.refreshAll}
            disabled={!courseId}
            loading={Object.values(controller.loading).some(Boolean)}
          >
            Làm mới
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
          onChange={setCourseId}
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
          REST API là nguồn dữ liệu chuẩn; WebSocket chỉ yêu cầu tải lại đúng khu vực.
        </Text>
      </ScopeBar>

      <Alert
        className="expert-training__role-guide"
        type="warning"
        showIcon
        title="Coverage → giao task mở → kiểm duyệt → Evaluation"
        description="TRAINING Gold Q&A được duyệt mới vào RAG. EVALUATION luôn là holdout và không được index."
      />

      <AsyncState
        loading={controller.loading.courses && !controller.courses.length}
        error={controller.errors.courses}
        empty={!controller.loading.courses && !controller.errors.courses && !controller.courses.length}
        emptyTitle="Chưa có môn học khả dụng"
        emptyDescription="Tạo môn học và index học liệu trước khi chạy Expert Co-Training V2."
        onRetry={controller.loadCourses}
      >
        {courseId ? (
          <Tabs
            activeKey={activeTab}
            onChange={(tab) => setQueryState({ tab, review: null })}
            items={tabs}
            className="expert-training__tabs"
          />
        ) : (
          <AsyncState
            empty
            emptyTitle="Chọn môn học để bắt đầu"
            emptyDescription="Coverage, hàng chờ duyệt và Evaluation được tách riêng theo từng môn."
          />
        )}
      </AsyncState>
    </div>
  );
}
