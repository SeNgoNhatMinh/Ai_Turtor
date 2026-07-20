import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizAssignments from '../../src/pages/teacher/QuizAssignments';
import { quizApi } from '../../src/services/quizApi';
import { teacherApi } from '../../src/services/teacherApi';
import { quizGateway } from '../../src/features/ai-harness/quizGateway';

vi.mock('../../src/features/ai-harness/quizGateway', () => ({
  quizGateway: {
    generateTeacherDraft: vi.fn(),
  },
}));

vi.mock('../../src/services/quizApi', () => ({
  quizApi: {
    getTeacherQuizAssignments: vi.fn(),
    publishQuizAssignment: vi.fn(),
    updateQuizAssignment: vi.fn(),
    deleteQuizAssignment: vi.fn(),
  },
}));

vi.mock('../../src/services/teacherApi', () => ({
  teacherApi: {
    getClassStudents: vi.fn(),
  },
}));

vi.mock('../../src/pages/teacher/QuizDraftEditor', () => ({
  default: ({ onSave, onStateChange }) => (
    <div>
      Draft editor
      <button type="button" onClick={() => onSave({ title: 'Updated OOP Review', questions: draft.questions })}>Save draft test</button>
      <button type="button" onClick={() => onStateChange({ dirty: true, valid: true })}>Mark draft dirty</button>
    </div>
  ),
}));

const draft = {
  assignmentId: 'quiz-assignment-1',
  title: 'OOP Review',
  courseId: 'PRO192',
  classId: 'SE1833',
  status: 'DRAFT',
  questions: [{
    questionId: 'q1',
    type: 'MULTIPLE_CHOICE',
    questionText: 'What is OOP?',
    options: ['Object-oriented programming', 'A database'],
    correctAnswer: 'Object-oriented programming',
  }],
};

describe('QuizAssignments publish flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizApi.getTeacherQuizAssignments.mockResolvedValue([draft]);
    quizApi.updateQuizAssignment.mockResolvedValue({ ...draft, title: 'Updated OOP Review' });
    quizApi.publishQuizAssignment.mockResolvedValue({ ...draft, status: 'PUBLISHED' });
    quizGateway.generateTeacherDraft.mockResolvedValue(draft);
    teacherApi.getClassStudents.mockResolvedValue({
      students: [{
        studentId: 'student-1',
        fullName: 'Nguyen Van A',
        email: 'student.a@fpt.edu.vn',
      }],
    });
  });

  it('shows a generated draft and saves it through the backend API', async () => {
    const triggerToast = vi.fn();
    render(
      <QuizAssignments
        teacherId="teacher-1"
        teacherName="Teacher A"
        courseId="PRO192"
        classId="SE1833"
        classesList={[{ classCode: 'SE1833', courseId: 'PRO192', name: 'Class SE1833' }]}
        triggerToast={triggerToast}
      />,
    );

    fireEvent.change(screen.getByLabelText('Tên quiz'), { target: { value: 'OOP Review' } });
    fireEvent.change(screen.getByLabelText('Chủ đề'), { target: { value: 'OOP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo draft quiz' }));

    expect(await screen.findByText('Draft editor')).toBeInTheDocument();
    expect(quizGateway.generateTeacherDraft).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft test' }));

    await waitFor(() => expect(quizApi.updateQuizAssignment).toHaveBeenCalledWith(
      'quiz-assignment-1',
      { title: 'Updated OOP Review', questions: draft.questions },
    ));
    expect(triggerToast).toHaveBeenCalledWith('Đã lưu draft quiz.');
  });

  it('shows the exact class roster by name and publishes to selected student IDs', async () => {
    render(
      <QuizAssignments
        teacherId="teacher-1"
        teacherName="Teacher A"
        courseId="PRO192"
        classId="SE1833"
        classesList={[{ classCode: 'SE1833', courseId: 'PRO192', name: 'Class SE1833' }]}
        triggerToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Xuất bản' }));
    const dialog = await screen.findByRole('dialog');

    expect(teacherApi.getClassStudents).toHaveBeenCalledWith('PRO192', 'SE1833', 'teacher-1');
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    fireEvent.click(await screen.findByText('Sinh viên được chọn'));

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('student.a@fpt.edu.vn')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xuất bản' }));

    await waitFor(() => expect(quizApi.publishQuizAssignment).toHaveBeenCalledWith(
      'quiz-assignment-1',
      {
        targetType: 'SELECTED_STUDENTS',
        targetStudentIds: ['student-1'],
      },
    ));
  });

  it('disables publishing while the open draft has unsaved changes', async () => {
    render(
      <QuizAssignments
        teacherId="teacher-1"
        courseId="PRO192"
        classId="SE1833"
        classesList={[{ classCode: 'SE1833', courseId: 'PRO192', name: 'Class SE1833' }]}
        triggerToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark draft dirty' }));

    expect(screen.getAllByRole('button', { name: /Xuất bản/ }).some((button) => button.disabled)).toBe(true);
  });

  it('switches the visible assignment list and saved draft with the teaching class', async () => {
    const aiDraft = {
      ...draft,
      assignmentId: 'quiz-assignment-2',
      title: 'AI Foundations',
      courseId: 'AI101',
      classId: 'AI101-01',
    };
    quizApi.getTeacherQuizAssignments.mockResolvedValue([draft, aiDraft]);

    function ScopedQuizAssignments() {
      const [scope, setScope] = useState({ courseId: 'PRO192', classId: 'SE1833' });
      const classes = [
        { name: 'Class SE1833', classId: 'SE1833', courseId: 'PRO192' },
        { name: 'Class AI101-01', classId: 'AI101-01', courseId: 'AI101' },
      ];
      return (
        <QuizAssignments
          teacherId="teacher-1"
          courseId={scope.courseId}
          classId={scope.classId}
          classesList={classes}
          onClassChange={(nextClassId) => {
            const selected = classes.find((item) => item.classId === nextClassId);
            setScope({ courseId: selected.courseId, classId: selected.classId });
          }}
          triggerToast={vi.fn()}
        />
      );
    }

    render(<ScopedQuizAssignments />);

    expect(await screen.findByText('OOP Review')).toBeInTheDocument();
    expect(screen.queryByText('AI Foundations')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark draft dirty' }));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Lớp học phần' }));
    fireEvent.click(await screen.findByText('Class AI101-01 · AI101'));

    expect(await screen.findByRole('dialog', { name: 'Đổi lớp học phần?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đổi lớp' }));

    expect(await screen.findByText('AI Foundations')).toBeInTheDocument();
    expect(screen.queryByText('OOP Review')).not.toBeInTheDocument();
    expect(screen.getAllByText('AI101 / AI101-01').length).toBeGreaterThan(0);
  });
});
