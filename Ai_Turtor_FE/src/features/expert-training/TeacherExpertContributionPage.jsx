import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
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
    <div className="portal-section expert-training-page expert-training-page--teacher">
      <PageHeader
        eyebrow="Chất lượng AI"
        title="Soạn bài thi Q&A vàng"
        description="Viết đúng chương Senior đã giao. Chấm AI trên sách trước, rồi bạn tự gửi Senior khi hài lòng."
        actions={<ActionButton icon={<ArrowLeft size={16} />} onClick={goBack}>Về danh sách task</ActionButton>}
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
            onExamGoldQa={controller.examGoldQa}
            onSendForReview={controller.sendGoldQaForReview}
            materialPreview={controller.taskMaterialPreview}
            materialLoading={controller.loading.taskMaterial}
            materialError={controller.errors.taskMaterial}
            contribution={controller.selectedTaskContribution}
            rejection={controller.selectedTaskRejection}
            onOpenMaterial={controller.openSourceMaterial}
            onSentToSenior={goBack}
          />
        )}
      </AsyncState>
    </div>
  );
}
