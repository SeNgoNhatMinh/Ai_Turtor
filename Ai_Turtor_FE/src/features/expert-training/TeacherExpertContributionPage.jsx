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
        title="Danh sách Q&A theo giáo trình"
        description="Thêm nhiều câu vào list (nháp) → Cho AI đánh giá lần 1 (chưa gắn ý) → đánh giá lại với ý GV → gửi Senior."
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
            onExamAllDrafts={controller.examAllDraftGoldQa}
            onSendForReview={controller.sendGoldQaForReview}
            onDeleteGoldQa={controller.deleteGoldQa}
            materialPreview={controller.taskMaterialPreview}
            materialLoading={controller.loading.taskMaterial}
            materialError={controller.errors.taskMaterial}
            contributions={controller.selectedTaskContributions}
            contribution={controller.selectedTaskContribution}
            onOpenMaterial={controller.openSourceMaterial}
          />
        )}
      </AsyncState>
    </div>
  );
}
