import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '../../src/components/Header';
import Sidebar from '../../src/components/Sidebar';
import ConversationGroup from '../../src/features/student/chat/conversations/ConversationGroup';
import TeacherClassesTab from '../../src/pages/teacher/TeacherClassesTab';
import { teacherApi } from '../../src/services/teacherApi';

vi.mock('../../src/services/teacherApi', () => ({
  teacherApi: {
    getCourseMemories: vi.fn(),
  },
}));

describe('UI action safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teacherApi.getCourseMemories.mockResolvedValue([]);
  });

  it('does not show fake service health or an account-role switch in the app chrome', () => {
    const { rerender } = render(
      <Sidebar activeRole="student" activeTab="student-chat" switchTab={vi.fn()} />,
    );

    expect(screen.queryByText('Backend API Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('MongoDB Running')).not.toBeInTheDocument();
    expect(screen.queryByText('Elasticsearch Ready')).not.toBeInTheDocument();

    rerender(
      <Header
        activeRole="admin"
        isDarkMode={false}
        setIsDarkMode={vi.fn()}
        currentUser={{ id: 'admin-1', role: 'ADMIN', fullName: 'System Admin' }}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText('Không gian: Quản trị viên')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Teacher Workspace/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Select role:')).not.toBeInTheDocument();
  });

  it('keeps class selection actionable but removes the toast-only student Support action', async () => {
    const setClassId = vi.fn();
    const refresh = vi.fn();

    render(
      <TeacherClassesTab
        courseId="PRO192"
        classId="SE1833"
        setClassId={setClassId}
        classesList={[
          { classId: 'SE1833', classCode: 'SE1833', name: 'Class SE1833', semester: 'SUMMER2026' },
          { classId: 'SE1840', classCode: 'SE1840', name: 'Class SE1840', semester: 'SUMMER2026' },
        ]}
        teacherStudents={[{ id: 'student-1', fullName: 'Student A', email: 'student@example.com' }]}
        loadTeacherDashboard={refresh}
        triggerToast={vi.fn()}
      />,
    );

    await waitFor(() => expect(teacherApi.getCourseMemories).toHaveBeenCalledWith('PRO192', 'SE1833'));
    expect(screen.queryByRole('button', { name: 'Support' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Làm mới/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Class SE1840/i }));
    expect(setClassId).toHaveBeenCalledWith('SE1840');
  });

  it('supports keyboard conversation selection without selecting from the action menu', () => {
    const onSelect = vi.fn();

    render(
      <ConversationGroup
        group={{
          label: 'Today',
          items: [{ id: 'conversation-1', title: 'Java basics', updatedAt: '2026-07-20T08:00:00Z' }],
        }}
        activeSessionId=""
        editingSessionId=""
        editingSessionTitle=""
        setEditingSessionTitle={vi.fn()}
        onSelect={onSelect}
        onSaveRename={vi.fn()}
        onMenuAction={vi.fn()}
      />,
    );

    const conversation = screen.getByRole('button', { name: /Java basics/i });
    fireEvent.keyDown(conversation, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('conversation-1', 'Java basics');

    fireEvent.click(screen.getByRole('button', { name: 'Thao tác cuộc trò chuyện' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
