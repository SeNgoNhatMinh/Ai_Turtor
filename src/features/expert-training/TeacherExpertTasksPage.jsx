import { useCallback, useState } from 'react';
import { Alert, Button, Select, Space, Tag, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AsyncState from '../../components/common/AsyncState';
import PageHeader from '../../components/common/PageHeader';
import ScopeBar from '../../components/common/ScopeBar';
import { expertTrainingApi } from '../../services/expertTrainingApi';
import { getUserFacingError } from '../../services/httpClient';
import ExpertTaskBoard from './components/ExpertTaskBoard';
import TaskPreviewDrawer from './components/TaskPreviewDrawer';
import { useExpertTrainingController } from './useExpertTrainingController';
import './ExpertTraining.css';

const { Text } = Typography;

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

  const connectionColor = controller.connectionState === 'CONNECTED' ? 'green' : 'orange';

  return (
    <div className="expert-training-page">
      <PageHeader
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
        <Space wrap size={[6, 6]}>
          <Tag color="blue">Giảng viên</Tag>
          <Tag color={connectionColor}>Realtime {controller.connectionState === 'CONNECTED' ? 'đã kết nối' : 'đang kết nối lại'}</Tag>
        </Space>
        <Text type="secondary" className="expert-training__canonical-note">
          Chỉ task của môn được phân công mới xuất hiện tại đây.
        </Text>
      </ScopeBar>

      <Alert
        className="expert-training__role-guide"
        type="info"
        showIcon
        title="Xem trước → nhận task → đọc tài liệu → đóng góp → chờ Senior duyệt"
        description="Bạn có thể mở Xem trước để đọc học liệu chương và hạn hoàn thành trước khi nhận task. Nội vừa gửi chưa vào AI cho đến khi được duyệt."
      />

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
