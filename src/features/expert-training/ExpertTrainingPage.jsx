import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Select, Space, Tabs, Tag } from 'antd';
import { RefreshCw } from 'lucide-react';
import AsyncState from '../../components/common/AsyncState';
import PageHeader from '../../components/common/PageHeader';
import ContributionWorkspace from './components/ContributionWorkspace';
import CoverageDashboard from './components/CoverageDashboard';
import EvaluationDashboard from './components/EvaluationDashboard';
import ExpertTaskBoard from './components/ExpertTaskBoard';
import SeniorReviewQueue from './components/SeniorReviewQueue';
import { useExpertTrainingController } from './useExpertTrainingController';
import { isTutorV2HarnessEnabled } from '../ai-harness/expertTrainingGateway';
import './ExpertTraining.css';

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
  const [activeTab, setActiveTab] = useState('coverage');
  const courseId = externalCourseId || localCourseId;
  const setCourseId = useCallback((nextCourseId) => {
    setLocalCourseId(nextCourseId);
    setExternalCourseId?.(nextCourseId);
  }, [setExternalCourseId]);

  const controller = useExpertTrainingController({
    currentUser,
    courseId,
    setCourseId,
    triggerToast,
  });

  const tabs = useMemo(() => {
    const items = [
      {
        key: 'coverage',
        label: 'Coverage',
        children: (
          <CoverageDashboard
            gaps={controller.resources.gaps}
            loading={controller.loading.gaps}
            error={controller.errors.gaps}
            canReview={controller.canReview}
            pendingAction={controller.pendingAction}
            onAnalyze={controller.analyzeCoverage}
            onRefresh={controller.loadGaps}
          />
        ),
      },
      {
        key: 'tasks',
        label: 'Expert Tasks',
        children: (
          <ExpertTaskBoard
            tasks={controller.resources.tasks}
            userId={controller.userId}
            loading={controller.loading.tasks}
            error={controller.errors.tasks}
            pendingAction={controller.pendingAction}
            onRefresh={controller.loadTasks}
            onClaim={controller.claimTask}
            onCreate={controller.createTask}
            onContribute={(task) => {
              controller.setSelectedTask(task);
              setActiveTab('contributions');
            }}
          />
        ),
      },
      {
        key: 'contributions',
        label: 'Contributions',
        children: (
          <ContributionWorkspace
            selectedTask={controller.selectedTask}
            userId={controller.userId}
            goldQa={controller.resources.goldQa}
            rubrics={controller.resources.rubrics}
            loading={controller.loading.contributions}
            error={controller.errors.contributions}
            pendingAction={controller.pendingAction}
            onRefresh={controller.loadContributions}
            onSubmitGoldQa={controller.submitGoldQa}
            onSubmitRubric={controller.submitRubric}
          />
        ),
      },
    ];

    if (controller.canReview) {
      items.push({
        key: 'review',
        label: controller.pendingReviewCount
          ? `Review Queue (${controller.pendingReviewCount})`
          : 'Review Queue',
        children: (
          <SeniorReviewQueue
            goldQa={controller.resources.goldQa}
            rubrics={controller.resources.rubrics}
            loading={controller.loading.contributions}
            error={controller.errors.contributions}
            pendingAction={controller.pendingAction}
            onRefresh={controller.loadContributions}
            onReviewGoldQa={controller.reviewGoldQa}
            onReviewRubric={controller.reviewRubric}
          />
        ),
      });
    }

    items.push({
      key: 'evaluation',
      label: 'Evaluation',
      children: (
        <EvaluationDashboard
          runs={controller.resources.evalRuns}
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
      ),
    });
    return items;
  }, [controller]);

  const connectionColor = controller.connectionState === 'CONNECTED'
    ? 'green'
    : controller.connectionState === 'RECONNECTING'
      ? 'orange'
      : 'default';
  const harnessEnabled = isTutorV2HarnessEnabled();

  return (
    <div className="expert-training-page">
      <PageHeader
        title="AI Knowledge Training"
        description="Tutor V2 turns measured course gaps into reviewed expert knowledge and private evaluation benchmarks."
        actions={(
          <>
            <Select
              aria-label="Tutor V2 course"
              showSearch
              optionFilterProp="label"
              value={courseId || undefined}
              placeholder="Select course"
              className="expert-training__course-select"
              loading={controller.loading.courses}
              onChange={setCourseId}
              options={controller.courses.map((course) => ({
                value: course.id,
                label: courseLabel(course),
              }))}
            />
            <Button
              icon={<RefreshCw size={16} />}
              onClick={controller.refreshAll}
              disabled={!courseId}
            >
              Refresh all
            </Button>
          </>
        )}
      />

      <div className="expert-training__status-bar">
        <Space wrap>
          <Tag color="blue">{controller.reviewerRole.replaceAll('_', ' ')}</Tag>
          <Tag color={harnessEnabled ? 'purple' : 'default'}>
            {harnessEnabled ? 'n8n V2 mutations' : 'Backend direct'}
          </Tag>
          <Tag color={connectionColor}>Realtime {controller.connectionState.toLowerCase()}</Tag>
          {controller.canReview && <Tag color="purple">Approval gate enabled</Tag>}
        </Space>
        <span>HTTP API is canonical; socket events only trigger focused refetches.</span>
      </div>

      <Alert
        type="info"
        showIcon
        title="Tutor V2 is an additional quality loop"
        description="It does not replace Student Chat, answer review, mentor escalation, quiz, or assignment flows. Teacher content cannot enter AI knowledge before Senior/Admin approval."
      />

      <AsyncState
        loading={controller.loading.courses && !controller.courses.length}
        error={controller.errors.courses}
        empty={!controller.loading.courses && !controller.errors.courses && !controller.courses.length}
        emptyTitle="No courses are available"
        emptyDescription="Create or assign a course before opening the Tutor V2 knowledge workflow."
        onRetry={controller.loadCourses}
      >
        {courseId ? (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabs}
            className="expert-training__tabs"
          />
        ) : (
          <Alert type="warning" showIcon title="Select a course to load Tutor V2 data" />
        )}
      </AsyncState>
    </div>
  );
}
