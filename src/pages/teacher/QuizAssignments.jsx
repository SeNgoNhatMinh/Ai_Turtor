import { Space, Tag, Typography } from 'antd';
import QuizDraftCreationCards from '../../features/teacher/quizzes/components/QuizDraftCreationCards';
import QuizDraftWorkspace from '../../features/teacher/quizzes/components/QuizDraftWorkspace';
import QuizAssignmentList from '../../features/teacher/quizzes/components/QuizAssignmentList';
import QuizClassSwitchModal from '../../features/teacher/quizzes/components/QuizClassSwitchModal';
import QuizPublishModal from '../../features/teacher/quizzes/components/QuizPublishModal';
import { useQuizAssignmentsController } from '../../features/teacher/quizzes/useQuizAssignmentsController';
import '../student/Quiz.css';

const { Text, Title } = Typography;

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

  return (
    <div className="portal-section quiz-page teacher-quiz-page">
      <div className="quiz-page-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>Quiz được giao</Title>
          <Text type="secondary">Tạo draft từ tài liệu đã lập chỉ mục, kiểm tra đáp án rồi xuất bản cho cả lớp hoặc sinh viên được chọn.</Text>
        </div>
        <Space wrap>
          {courseId && <Tag color="orange">Môn: {courseId}</Tag>}
          {classId && <Tag>Lớp: {classId}</Tag>}
        </Space>
      </div>

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
