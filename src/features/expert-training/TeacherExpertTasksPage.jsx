import { useCallback, useState } from 'react';
import { Alert, Button, Select, Space, Tag, Typography } from 'antd';
import { RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AsyncState from '../../components/common/AsyncState';
import PageHeader from '../../components/common/PageHeader';
import ScopeBar from '../../components/common/ScopeBar';
import ExpertTaskBoard from './components/ExpertTaskBoard';
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

  const connectionColor = controller.connectionState === 'CONNECTED' ? 'green' : 'orange';

  return (
    <div className="expert-training-page">
      <PageHeader
        title="Công việc tri thức AI"
        description="Nhận task từ Senior, đối chiếu với học liệu môn học và đóng góp nội dung có kiểm soát."
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
        title="Nhận task → đọc tài liệu → đóng góp → chờ Senior duyệt"
        description="Nội dung vừa gửi chưa được đưa vào AI. Chỉ TRAINING Gold Q&A được phê duyệt mới được index vào RAG."
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
          />
        )}
      </AsyncState>
    </div>
  );
}
