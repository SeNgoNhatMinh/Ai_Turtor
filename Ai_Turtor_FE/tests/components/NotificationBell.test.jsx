import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeEventsContext } from '../../src/features/realtime/realtimeContext';
import NotificationBell from '../../src/features/notifications/NotificationBell';
import { notificationsApi } from '../../src/services/notificationsApi';

vi.mock('../../src/services/notificationsApi', () => ({
  notificationsApi: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

function OpenedTicket() {
  const [params] = useSearchParams();
  return <div>Đã mở {params.get('ticket')}</div>;
}

function renderBell() {
  return render(
    <RealtimeEventsContext.Provider value={{
      connectionState: 'CONNECTED',
      connectionVersion: 1,
      subscribe: () => () => {},
    }}
    >
      <MemoryRouter initialEntries={['/student/dashboard']}>
        <Routes>
          <Route path="/student/dashboard" element={<NotificationBell userId="student-1" accountRole="STUDENT" />} />
          <Route path="/student/mentor-review" element={<OpenedTicket />} />
        </Routes>
      </MemoryRouter>
    </RealtimeEventsContext.Provider>,
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    notificationsApi.list.mockResolvedValue({
      notifications: [{
        id: 'notice-1',
        title: 'Cô Lan đã phản hồi yêu cầu hỗ trợ',
        body: 'JDK khác JRE ở điểm nào?',
        questionEscalationId: 'escalation-1',
        createdAt: '2026-11-01T00:40:00',
        readAt: null,
        unread: true,
      }],
      unreadCount: 1,
    });
    notificationsApi.markRead.mockResolvedValue({});
  });

  it('shows the unread count, the short reply, and opens that support request', async () => {
    renderBell();

    expect(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    expect(screen.getByText('JDK khác JRE ở điểm nào?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cô Lan đã phản hồi yêu cầu hỗ trợ/ }));

    await waitFor(() => {
      expect(notificationsApi.markRead).toHaveBeenCalledWith('notice-1');
      expect(screen.getByText('Đã mở escalation-1')).toBeInTheDocument();
    });
  });
});
