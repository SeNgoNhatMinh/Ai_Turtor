import { Space, Tag } from 'antd';
import PageHeader from '../../../components/common/PageHeader';
import QuizDraftCreationCards from './components/QuizDraftCreationCards';
import QuizDraftWorkspace from './components/QuizDraftWorkspace';
import QuizAssignmentList from './components/QuizAssignmentList';
import QuizClassSwitchModal from './components/QuizClassSwitchModal';
import QuizPublishModal from './components/QuizPublishModal';
import QuizScoreboardDrawer from './components/QuizScoreboardDrawer';
import { useQuizAssignmentsController } from './useQuizAssignmentsController';
import { useQuizScoreboard } from './useQuizScoreboard';
import '../../student/quizzes/Quiz.css';

function QuizAssignments({
  teacherId,
  teacherName = '',
  courseId,
  classId,
  classesList = [],
  classesLoading = false,
  onClassChange,
  teacherStudents = [],
  triggerToast,
}) {
  const controller = useQuizAssignmentsController({
    teacherId,
    teacherName,
    courseId,
    classId,
    classesList,
    onClassChange,
    teacherStudents,
    triggerToast,
  });

  const scoreboard = useQuizScoreboard({
    teacherId,
    courseId,
    classId,
    teacherStudents,
    triggerToast,
  });

  return (
    <div className="portal-section quiz-page teacher-quiz-page">
      <PageHeader
        eyebrow="Giảng dạy"
        title="Quiz được giao"
        description="Tạo draft từ tài liệu đã lập chỉ mục, kiểm tra đáp án rồi xuất bản cho cả lớp hoặc sinh viên được chọn."
        actions={(
          <Space wrap>
            {courseId && <Tag color="orange">Môn: {courseId}</Tag>}
            {classId && <Tag>Lớp: {classId}</Tag>}
          </Space>
        )}
      />

      <QuizDraftCreationCards
        form={controller.form}
        classOptions={controller.classOptions}
        classesLoading={classesLoading}
        loading={controller.loading}
        teacherId={teacherId}
        courseId={courseId}
        classId={classId}
        onClassChange={controller.requestClassSwitch}
        onGenerate={controller.generateDraft}
        onManualCreated={controller.handleManualQuizCreated}
        triggerToast={triggerToast}
      />

      <QuizDraftWorkspace
        draft={controller.draft}
        editorRef={controller.draftEditorRef}
        editorState={controller.draftEditorState}
        saving={controller.saving}
        onSave={controller.saveDraft}
        onStateChange={controller.handleDraftStateChange}
        onPublish={controller.openPublishDialog}
        onDelete={controller.deleteDraft}
      />

      <QuizAssignmentList
        assignments={controller.scopedAssignments}
        courseId={courseId}
        classId={classId}
        activeDraft={controller.draft}
        editorState={controller.draftEditorState}
        onEdit={controller.showDraftEditor}
        onPublish={controller.openPublishDialog}
        onDelete={controller.deleteDraft}
        onViewScoreboard={scoreboard.openScoreboard}
      />

      <QuizScoreboardDrawer
        open={scoreboard.open}
        assignment={scoreboard.assignment}
        loading={scoreboard.loading}
        error={scoreboard.error}
        rows={scoreboard.rows}
        summary={scoreboard.summary}
        onClose={scoreboard.closeScoreboard}
      />

      <QuizClassSwitchModal
        pendingClass={controller.pendingClassSwitch}
        onCancel={controller.cancelClassSwitch}
        onConfirm={controller.applyClassSwitch}
      />

      <QuizPublishModal
        open={controller.publishOpen}
        draft={controller.draft}
        courseId={courseId}
        classId={classId}
        publishing={controller.publishing}
        target={controller.publishTarget}
        selectedStudents={controller.selectedStudents}
        students={controller.publishStudents}
        visibleStudents={controller.visiblePublishStudents}
        studentsLoading={controller.publishStudentsLoading}
        visibleStudentIds={controller.visibleStudentIds}
        allVisibleSelected={controller.allVisibleSelected}
        keyword={controller.studentKeyword}
        onCancel={controller.cancelPublish}
        onConfirm={controller.publishDraft}
        onTargetChange={controller.changePublishTarget}
        onKeywordChange={controller.setStudentKeyword}
        onToggleStudent={controller.toggleStudent}
        onToggleVisible={controller.toggleVisibleStudents}
      />
    </div>
  );
}

export default QuizAssignments;
