import { useCallback, useMemo, useState } from 'react';
import { Alert, Select } from 'antd';
import { ClipboardList, Database, PenLine, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import AsyncState from '../../components/common/AsyncState';
import MetricStrip from '../../components/common/MetricStrip';
import PageHeader from '../../components/common/PageHeader';
import ScopeBar from '../../components/common/ScopeBar';
import WorkflowStepper from '../../components/common/WorkflowStepper';
import { expertTrainingApi } from '../../services/expertTrainingApi';
import { getUserFacingError } from '../../services/httpClient';
import ExpertTaskBoard from './components/ExpertTaskBoard';
import TaskPreviewDrawer from './components/TaskPreviewDrawer';
import { buildTeacherGoldQaSummary } from './expertTaskBoardUtils';
import { useExpertTrainingController } from './useExpertTrainingController';
import './ExpertTraining.css';

const TEACHER_STEPS = [
  { key: 'senior-start', title: 'Senior giao chương', description: 'Chương đã có chunks' },
  { key: 'claim', title: 'Nhận task', description: 'Task được khóa cho bạn' },
  { key: 'write', title: 'Viết Q&A', description: 'Bám đúng giáo trình' },
  { key: 'exam', title: 'AI chấm bằng sách', description: 'Q&A chưa vào RAG' },
  { key: 'decision', title: 'Senior quyết định', description: 'Nạp RAG hoặc trả lại' },
];

export default function TeacherExpertTasksPage({
  currentUser,
  courseId: externalCourseId = '',
  setCourseId: setExternalCourseId,
  triggerToast,
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localCourseId, setLocalCourseId] = useState(externalCourseId);
  const [previewTask, setPreviewTask] = useState(null);
  const [taskPreview, setTaskPreview] = useState(null);
  const [taskPreviewLoading, setTaskPreviewLoading] = useState(false);
  const [taskPreviewError, setTaskPreviewError] = useState('');
  const queryCourseId = searchParams.get('courseId') || '';
  const courseId = queryCourseId || externalCourseId || localCourseId;

  const setCourseId = useCallback((nextCourseId) => {
    setLocalCourseId(nextCourseId);
    setExternalCourseId?.(nextCourseId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextCourseId) next.set('courseId', nextCourseId);
      else next.delete('courseId');
      return next;
    }, { replace: true });
  }, [setExternalCourseId, setSearchParams]);

  const controller = useExpertTrainingController({
    currentUser,
    courseId,
    setCourseId,
    triggerToast,
    mode: 'teacher',
  });

  const openContribution = useCallback((task) => {
    navigate(`/teacher/expert-tasks/${encodeURIComponent(task.id)}/contribute?courseId=${encodeURIComponent(courseId)}`);
  }, [courseId, navigate]);

  const closeTaskPreview = useCallback(() => {
    setPreviewTask(null);
    setTaskPreview(null);
    setTaskPreviewError('');
  }, []);

  const openTaskPreview = useCallback(async (task) => {
    if (!courseId || !task?.chapter) {
      triggerToast?.('Chọn môn học trước khi xem trước task.');
      return;
    }
    setPreviewTask(task);
    setTaskPreview(null);
    setTaskPreviewError('');
    setTaskPreviewLoading(true);
    try {
      const preview = await expertTrainingApi.getChapterPreviewByTitle(courseId, task.chapter, false);
      setTaskPreview(preview);
    } catch (error) {
      setTaskPreviewError(getUserFacingError(error, 'Không thể tải tài liệu chương.'));
    } finally {
      setTaskPreviewLoading(false);
    }
  }, [courseId, triggerToast]);

  const summary = useMemo(() => buildTeacherGoldQaSummary(
    controller.resources.tasks,
    controller.resources.goldQa,
    controller.userId,
  ), [controller.resources.goldQa, controller.resources.tasks, controller.userId]);
  const activeStep = summary.pendingReview ? 3
    : summary.active || summary.needsRevision ? 2
      : summary.available ? 1
        : summary.completed || summary.indexed ? 4 : 0;

  return (
    <div className="portal-section expert-training-page expert-training-page--teacher">
      <PageHeader
        eyebrow="Chất lượng AI"
        title="Q&A huấn luyện AI theo giáo trình"
        description="Nhận task GOLD_QA do Senior mở từ mục lục, soạn đáp án chuẩn và gửi bài thi để Senior duyệt."
      />

      <ScopeBar
        actions={(
          <ActionButton
            icon={<RefreshCw size={16} />}
            onClick={controller.refreshAll}
            disabled={!courseId}
            loading={controller.loading.tasks || controller.loading.contributions}
          >
            Làm mới
          </ActionButton>
        )}
      >
        <Select
          aria-label="Chọn môn học cho công việc tri thức"
          showSearch
          optionFilterProp="label"
          value={courseId || undefined}
          placeholder="Chọn môn được phân công"
          className="expert-training__course-select"
          loading={controller.loading.courses}
          onChange={setCourseId}
          options={controller.courses.map((course) => ({
            value: course.id,
            label: course.name && course.name !== course.id ? `${course.id} · ${course.name}` : course.id,
          }))}
        />
      </ScopeBar>

      {courseId && (
        <MetricStrip
          ariaLabel="Tổng quan công việc Q&A vàng"
          items={[
            {
              key: 'available',
              label: 'Việc mở',
              value: summary.available,
              description: 'Senior đã giao, chưa có người nhận',
              icon: ClipboardList,
            },
            {
              key: 'active',
              label: 'Đang soạn',
              value: summary.active,
              description: summary.needsRevision ? `${summary.needsRevision} bài cần sửa` : 'Task đang thuộc về bạn',
              icon: PenLine,
            },
            {
              key: 'review',
              label: 'Chờ Senior',
              value: summary.pendingReview,
              description: 'Đã chấm AI bằng giáo trình',
              icon: ShieldCheck,
            },
            {
              key: 'indexed',
              label: 'Đã nạp RAG',
              value: summary.indexed,
              description: 'Senior đã phê duyệt',
              icon: Database,
            },
          ]}
        />
      )}

      <section className="expert-training__workflow-guide" aria-label="Quy trình đóng góp tri thức">
        <div>
          <strong>Vai trò của Teacher</strong>
          <span>Bạn không tự tạo task và không tự cho AI học. Senior kiểm soát chương và bước nạp RAG.</span>
        </div>
        <WorkflowStepper steps={TEACHER_STEPS} activeIndex={activeStep} />
      </section>

      {courseId && !controller.loading.tasks && summary.available === 0 && summary.active === 0
        && summary.pendingReview === 0 && summary.completed === 0 && (
        <Alert
          type="info"
          showIcon
          title="Chưa có chương được Senior giao"
          description="Màn Teacher chỉ có task sau khi Senior chọn một chương có chunks và bấm Bắt đầu chương."
        />
      )}

      <AsyncState
        loading={controller.loading.courses && !controller.courses.length}
        error={controller.errors.courses}
        empty={!controller.loading.courses && !controller.errors.courses && !controller.courses.length}
        emptyTitle="Chưa có môn học được phân công"
        emptyDescription="Liên hệ Admin để gán giảng viên vào lớp học phần trước khi nhận task."
        onRetry={controller.loadCourses}
      >
        {courseId && (
          <ExpertTaskBoard
            tasks={controller.resources.tasks}
            goldQa={controller.resources.goldQa}
            userId={controller.userId}
            loading={controller.loading.tasks}
            error={controller.errors.tasks}
            pendingAction={controller.pendingAction}
            onRefresh={controller.loadTasks}
            onClaim={controller.claimTask}
            onContribute={openContribution}
            onPreviewTask={openTaskPreview}
          />
        )}
      </AsyncState>

      <TaskPreviewDrawer
        task={previewTask}
        preview={taskPreview}
        loading={taskPreviewLoading}
        error={taskPreviewError}
        open={Boolean(previewTask)}
        onClose={closeTaskPreview}
        onOpenMaterial={controller.openSourceMaterial}
      />
    </div>
  );
}
