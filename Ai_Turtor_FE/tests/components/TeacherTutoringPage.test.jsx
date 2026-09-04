import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeacherTutoringPage from '../../src/features/teacher/tutoring/TeacherTutoringPage';
import { teacherApi } from '../../src/services/teacherApi';
import { tutorSessionApi } from '../../src/services/tutorSessionApi';

vi.mock('../../src/services/teacherApi', () => ({
  teacherApi: {
    getClassStudents: vi.fn(),
    getCourseMemories: vi.fn(),
  },
}));

vi.mock('../../src/services/tutorSessionApi', () => ({
  tutorSessionApi: {
    listTeacherSummaries: vi.fn(),
    listTeacherSessions: vi.fn(),
    listDirectives: vi.fn(),
    getTranscript: vi.fn(),
    getSessionTranscript: vi.fn(),
    createDirective: vi.fn(),
    confirmDirective: vi.fn(),
    archiveDirective: vi.fn(),
  },
}));

const studentId = '7bd7d121-b1b4-4b47-b077-a1d617a98219';
const idleStudentId = '860aa103-2f5c-48a3-bcf2-9ec2a12a8c40';

describe('TeacherTutoringPage student identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tutorSessionApi.listTeacherSummaries.mockResolvedValue({ summaries: [] });
    tutorSessionApi.listTeacherSessions.mockResolvedValue({
      sessions: [{
        id: 'session-1',
        studentId,
        topic: '',
        status: 'ACTIVE',
        studentTurnCount: 3,
        updatedAt: '2026-09-04T10:15:00',
      }],
    });
    tutorSessionApi.listDirectives.mockResolvedValue({ directives: [] });
    tutorSessionApi.getSessionTranscript.mockResolvedValue({
      session: { id: 'session-1', studentId, topic: '' },
      messages: [{ id: 'm1', role: 'STUDENT', content: 'Em hỏi về JSP' }],
    });
    teacherApi.getCourseMemories.mockResolvedValue({
      memories: [{
        studentId,
        learnedTopics: ['jsp', 'Tóm tắt các câu hỏi gần đây'],
        recentQuestions: [
          'Thực hành đọc biến và stack trace trong cửa sổ Debug của IntelliJ/Eclipse để nắm vững cách theo dõi luồng thực thi',
        ],
        weakTopics: ['AI Learning Improvement Plan', 'Nắm vững JSTL và Java trong JSP'],
      }],
    });
    teacherApi.getClassStudents.mockResolvedValue({
      students: [
        {
          studentId,
          studentName: 'Nguyen Van A',
          studentCode: 'SE1840001',
          studentEmail: 'anvse1840001@fpt.edu.vn',
        },
        {
          studentId: idleStudentId,
          studentName: 'Tran Thi B',
          studentCode: 'SE1840002',
          studentEmail: 'btse1840002@fpt.edu.vn',
        },
      ],
    });
  });

  it('lists every class student and the topics they already studied', async () => {
    render(
      <TeacherTutoringPage
        teacherId="teacher-1"
        courseId="PRJ301"
        classId="SE1840"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Nguyen Van A · SE1840001').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Tran Thi B · SE1840002').length).toBeGreaterThan(0);
    expect(screen.getByText('jsp')).toBeVisible();
    expect(screen.getByText('Chưa học với AI Tutor')).toBeVisible();
    expect(screen.getByText('Danh sách sinh viên')).toBeVisible();
    expect(screen.queryByText('Tóm tắt các câu hỏi gần đây')).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có buổi học đủ 10 lượt để tổng kết.')).not.toBeInTheDocument();
    expect(screen.queryByText(studentId)).not.toBeInTheDocument();
  });

  it('opens a structured student study drawer instead of overflowing topic pills', async () => {
    render(
      <TeacherTutoringPage
        teacherId="teacher-1"
        courseId="PRJ301"
        classId="SE1840"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Xem bài đã học' }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Xem bài đã học' })[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Nguyen Van A · SE1840001').length).toBeGreaterThan(1);
    });
    expect(screen.getByText('Bài đã học')).toBeVisible();
    expect(screen.getByText('Chủ đề đã học')).toBeVisible();
    expect(screen.getByText('Câu hỏi gần đây')).toBeVisible();
    expect(screen.getByText(/Thực hành đọc biến và stack trace/)).toBeVisible();
    expect(screen.queryByText('Tóm tắt các câu hỏi gần đây')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Learning Improvement Plan')).not.toBeInTheDocument();
    expect(screen.getAllByText('Nắm vững JSTL và Java trong JSP').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Đang học/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Xem hội thoại' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Xem hội thoại' }));

    await waitFor(() => {
      expect(screen.getByText('Hội thoại')).toBeVisible();
    });
    expect(screen.getByRole('button', { name: '← Quay lại bài đã học' })).toBeVisible();
    expect(screen.queryByText('Câu hỏi gần đây')).not.toBeInTheDocument();
    expect(screen.getByText('Em hỏi về JSP')).toBeVisible();
  });
});
