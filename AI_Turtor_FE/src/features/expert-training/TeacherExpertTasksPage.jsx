import { useCallback, useState } from 'react';
import { Button, Select } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AsyncState from '../../components/common/AsyncState';
import PageHeader from '../../components/common/PageHeader';
import ScopeBar from '../../components/common/ScopeBar';
import WorkflowStepper from '../../components/common/WorkflowStepper';
import { expertTrainingApi } from '../../services/expertTrainingApi';
import { getUserFacingError } from '../../services/httpClient';
import ExpertTaskBoard from './components/ExpertTaskBoard';
import TaskPreviewDrawer from './components/TaskPreviewDrawer';
import { useExpertTrainingController } from './useExpertTrainingController';
import './ExpertTraining.css';

const TEACHER_STEPS = [
  { key: 'open', title: 'Chọn task', description: 'Đọc yêu cầu và học liệu' },
  { key: 'assigned', title: 'Nhận việc', description: 'Khóa task cho tài khoản của bạn' },
  { key: 'contribute', title: 'Đóng góp', description: 'Soạn Gold Q&A hoặc Rubric' },
  { key: 'review', title: 'Chờ duyệt', description: 'Senior đối chiếu trước khi dùng' },
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
      const preview = await expertTrainingApi.getChapterPreviewByTitle(courseId, task.chapter, true);
      setTaskPreview(preview);
    } catch (error) {
      setTaskPreviewError(getUserFacingError(error, 'Không thể tải tài liệu chương.'));
    } finally {
      setTaskPreviewLoading(false);
    }
  }, [courseId, triggerToast]);

  const taskStatuses = new Set(controller.resources.tasks.map((task) => String(task.status || '').toUpperCase()));
  const activeStep = taskStatuses.has('SUBMITTED') ? 3
    : taskStatuses.has('ASSIGNED') || taskStatuses.has('IN_PROGRESS') ? 2
      : taskStatuses.has('OPEN') ? 0 : 0;

  return (
    <div className="expert-training-page">
      <PageHeader
        eyebrow="Chất lượng AI"
        title="Công việc tri thức AI"
        description="Xem trước học liệu, kiểm tra hạn Senior giao, nhận task và đóng góp nội dung có kiểm soát."
      />

      <ScopeBar
        actions={(
          <Button
            icon={<RefreshCw size={16} />}
            onClick={controller.refreshAll}
            disabled={!courseId}
            loading={controller.loading.tasks || controller.loading.contributions}
          >
            Làm mới
          </Button>
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

      <section className="expert-training__workflow-guide" aria-label="Quy trình đóng góp tri thức">
        <div>
          <strong>Việc bạn cần làm</strong>
          <span>Nội dung vừa gửi chưa vào AI cho đến khi Senior phê duyệt.</span>
        </div>
        <WorkflowStepper steps={TEACHER_STEPS} activeIndex={activeStep} />
      </section>

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
