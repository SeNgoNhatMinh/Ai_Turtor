import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeacherReviewPage from '../../src/features/teacher/review/TeacherReviewPage';
import { useTeacherReviewQueue } from '../../src/features/teacher/review/useTeacherReviewQueue';

vi.mock('../../src/features/teacher/review/useTeacherReviewQueue', () => ({
  useTeacherReviewQueue: vi.fn(),
}));

vi.mock('../../src/services/teacherApi', () => ({
  teacherApi: {
    getClassSections: vi.fn().mockResolvedValue([]),
  },
}));

import { teacherApi } from '../../src/services/teacherApi';

const buildReviewState = (handleTeacherAnswerEsc, overrides = {}) => ({
  escalations: [{ id: 'esc-1', status: 'CHAT_ACTIVE', student: 'Student A', title: 'OOP question' }],
  selectedEscalation: { id: 'esc-1', status: 'CHAT_ACTIVE', question: 'What is inheritance?' },
  setSelectedEscalation: vi.fn(),
  candidates: [],
  answerReviews: [],
  seniorAnswerReviews: [],
  isTeacherInboxLoading: false,
  isAnswerReviewsLoading: false,
  isTeacherAnswerSubmitting: false,
  pendingCandidateActionIds: [],
  pendingSeniorReviewIds: [],
  loadTeacherInbox: vi.fn(),
  loadAnswerReviews: vi.fn(),
  loadKnowledgeCandidates: vi.fn(),
  handleTeacherAnswerEsc,
  handleSeniorResolveReview: vi.fn(),
  handleApproveCandidate: vi.fn(),
  handleRejectCandidate: vi.fn(),
  ...overrides,
});

describe('TeacherReviewPage official answer action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the teacher answer when the mutation fails', async () => {
    const submit = vi.fn().mockResolvedValue(false);
    useTeacherReviewQueue.mockReturnValue(buildReviewState(submit));
    render(
      <TeacherReviewPage
        currentUser={{ id: 'teacher-1', role: 'TEACHER', fullName: 'Teacher A' }}
        teacherId="teacher-1"
        courseId="PRO192"
        classId="SE1833"
        triggerToast={vi.fn()}
      />,
    );

    const answer = screen.getByLabelText('Câu trả lời cuối sau khi trao đổi:');
    fireEvent.change(answer, { target: { value: 'A verified explanation.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi câu trả lời chính thức' }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(answer).toHaveValue('A verified explanation.');
  });

  it('clears the answer only after a successful mutation', async () => {
    const submit = vi.fn().mockResolvedValue(true);
    useTeacherReviewQueue.mockReturnValue(buildReviewState(submit));
    render(
      <TeacherReviewPage
        currentUser={{ id: 'teacher-1', role: 'TEACHER', fullName: 'Teacher A' }}
        teacherId="teacher-1"
        courseId="PRO192"
        classId="SE1833"
        triggerToast={vi.fn()}
      />,
    );

    const answer = screen.getByLabelText('Câu trả lời cuối sau khi trao đổi:');
    fireEvent.change(answer, { target: { value: 'A verified explanation.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi câu trả lời chính thức' }));

    await waitFor(() => expect(answer).toHaveValue(''));
  });

  it('shows the teacher classes and auto-selects the first one', async () => {
    useTeacherReviewQueue.mockReturnValue(buildReviewState(vi.fn()));
    teacherApi.getClassSections.mockResolvedValue([
      { courseId: 'PRO192', classId: 'SE1833', className: 'SE1833' },
      { courseId: 'PRJ301', classId: 'SE1840', className: 'SE1840' },
    ]);
    const setCourseId = vi.fn();
    const setClassId = vi.fn();
    render(
      <TeacherReviewPage
        currentUser={{ id: 'teacher-1', role: 'TEACHER', fullName: 'Teacher A' }}
        teacherId="teacher-1"
        courseId=""
        classId=""
        setCourseId={setCourseId}
        setClassId={setClassId}
        triggerToast={vi.fn()}
      />,
    );

    expect(screen.getByText('Lớp học của bạn')).toBeInTheDocument();
    await waitFor(() => expect(setCourseId).toHaveBeenCalledWith('PRJ301'));
    expect(setClassId).toHaveBeenCalledWith('SE1840');
    expect(await screen.findByText(/Bạn đang phụ trách 2 lớp/)).toBeInTheDocument();
  });

  it('disables the action while a mutation is pending', () => {
    useTeacherReviewQueue.mockReturnValue(buildReviewState(vi.fn(), { isTeacherAnswerSubmitting: true }));
    render(
      <TeacherReviewPage
        currentUser={{ id: 'teacher-1', role: 'TEACHER', fullName: 'Teacher A' }}
        teacherId="teacher-1"
        courseId="PRO192"
        classId="SE1833"
        triggerToast={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Đang gửi câu trả lời...' })).toBeDisabled();
  });
});
