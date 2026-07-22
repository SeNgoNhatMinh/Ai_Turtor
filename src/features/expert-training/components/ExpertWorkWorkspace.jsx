import { Alert } from 'antd';
import ContributionWorkspace from './ContributionWorkspace';
import ExpertTaskBoard from './ExpertTaskBoard';

export default function ExpertWorkWorkspace({
  tasks,
  selectedTask,
  draftChapter,
  userId,
  canReview,
  loading,
  errors,
  pendingAction,
  onRefreshTasks,
  onClaimTask,
  onCreateTask,
  onSelectTask,
  onDraftConsumed,
  onSubmitGoldQa,
  onSubmitRubric,
  taskMaterialPreview,
  selectedTaskRejection,
  onOpenMaterial,
}) {
  return (
    <div className="expert-training__work-layout">
      <ExpertTaskBoard
        tasks={tasks}
        selectedTask={selectedTask}
        draftChapter={draftChapter}
        userId={userId}
        canReview={canReview}
        loading={loading.tasks}
        error={errors.tasks}
        pendingAction={pendingAction}
        onRefresh={onRefreshTasks}
        onClaim={onClaimTask}
        onCreate={onCreateTask}
        onContribute={onSelectTask}
        onDraftConsumed={onDraftConsumed}
      />

      {selectedTask ? (
        <ContributionWorkspace
          selectedTask={selectedTask}
          userId={userId}
          pendingAction={pendingAction}
          onSubmitGoldQa={onSubmitGoldQa}
          onSubmitRubric={onSubmitRubric}
          materialPreview={taskMaterialPreview}
          materialLoading={loading.taskMaterial}
          materialError={errors.taskMaterial}
          rejection={selectedTaskRejection}
          onOpenMaterial={onOpenMaterial}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          title="Chọn một công việc để bắt đầu đóng góp"
          description="Nhận công việc đang mở hoặc chọn công việc đã được giao cho bạn. Biểu mẫu Gold Q&A hoặc Rubric sẽ xuất hiện tại đây."
        />
      )}
    </div>
  );
}
