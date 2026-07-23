import { useCallback, useEffect, useState } from 'react';
import { Button } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AsyncState from '../../components/common/AsyncState';
import PageHeader from '../../components/common/PageHeader';
import ContributionWorkspace from './components/ContributionWorkspace';
import { useExpertTrainingController } from './useExpertTrainingController';
import './ExpertTraining.css';

export default function TeacherExpertContributionPage({
  currentUser,
  courseId: externalCourseId = '',
  setCourseId: setExternalCourseId,
  triggerToast,
}) {
  const { taskId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [localCourseId, setLocalCourseId] = useState(externalCourseId);
  const courseId = searchParams.get('courseId') || externalCourseId || localCourseId;

  const setCourseId = useCallback((nextCourseId) => {
    setLocalCourseId(nextCourseId);
    setExternalCourseId?.(nextCourseId);
  }, [setExternalCourseId]);

  const controller = useExpertTrainingController({
    currentUser,
    courseId,
    selectedTaskId: taskId,
    setCourseId,
    triggerToast,
    mode: 'teacher',
  });
  const selectedTask = controller.selectedTask;
  const loadTaskMaterialPreview = controller.loadTaskMaterialPreview;

  useEffect(() => {
    loadTaskMaterialPreview(selectedTask?.chapter || '');
  }, [loadTaskMaterialPreview, selectedTask?.chapter]);

  const goBack = useCallback(() => {
    navigate(`/teacher/expert-tasks${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`);
  }, [courseId, navigate]);

  return (
    <div className="expert-training-page">
      <PageHeader
        title="Đóng góp tri thức"
        description="Soạn nội dung dựa trên học liệu chương và gửi Senior kiểm duyệt."
        actions={<Button icon={<ArrowLeft size={16} />} onClick={goBack}>Về Task Board</Button>}
      />

      <AsyncState
        loading={controller.loading.tasks && !selectedTask}
        error={controller.errors.tasks}
        empty={!controller.loading.tasks && !controller.errors.tasks && !selectedTask}
        emptyTitle="Không tìm thấy task"
        emptyDescription="Task không thuộc môn hiện tại hoặc đã bị xóa."
        onRetry={controller.loadTasks}
      >
        {selectedTask && (
          <ContributionWorkspace
            selectedTask={selectedTask}
            userId={controller.userId}
            pendingAction={controller.pendingAction}
            onSubmitGoldQa={controller.submitGoldQa}
            onSubmitRubric={controller.submitRubric}
            materialPreview={controller.taskMaterialPreview}
            materialLoading={controller.loading.taskMaterial}
            materialError={controller.errors.taskMaterial}
            rejection={controller.selectedTaskRejection}
            onOpenMaterial={controller.openSourceMaterial}
            onSubmitted={goBack}
          />
        )}
      </AsyncState>
    </div>
  );
}
