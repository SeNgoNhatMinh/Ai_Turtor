import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MentorReviewPage from '../../src/features/student/mentor-review/MentorReviewPage';
import { supportChatApi } from '../../src/services/supportChatApi';

vi.mock('../../src/services/supportChatApi', () => ({
  supportChatApi: {
    getEscalationHistory: vi.fn(),
    getEscalationDetail: vi.fn(),
  },
}));

const reviewTicket = {
  id: 'ticket-review',
  originalQuestion: 'Kế thừa trong Java là gì?',
  status: 'MENTOR_ANSWERED_PENDING_SENIOR_REVIEW',
  mentorAnswer: 'Câu trả lời đang chờ duyệt.',
  createdAt: '2026-09-13T09:00:00Z',
};

const resolvedTicket = {
  id: 'ticket-resolved',
  originalQuestion: 'Servlet là gì?',
  conversationId: 'conversation-resolved',
  createdAt: '2026-09-12T09:00:00Z',
};

function SupportPageRoute() {
  const navigate = useNavigate();
  return (
    <MentorReviewPage
      currentUser={{ id: 'student-1', role: 'STUDENT' }}
      switchTab={(tab) => navigate(tab === 'student-chat' ? '/student/chat' : '/student/mentor-review')}
    />
  );
}

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="Đường dẫn hiện tại">{location.pathname}{location.search}</output>;
}

describe('MentorReviewPage navigation', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => queryClient.clear());

  function renderSupportPage(path = '/student/mentor-review') {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <CurrentLocation />
          <Routes>
            <Route path="/student/mentor-review" element={<SupportPageRoute />} />
            <Route path="/student/chat" element={<h1>Student chat</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it.each([
    { status: 'RESOLVED_INDEXED', studentVisibleStatus: '' },
    { status: 'COMPLETED', studentVisibleStatus: 'AI_BRAIN_UPDATED' },
  ])('keeps a selected $status / $studentVisibleStatus ticket on the support page', async (state) => {
    const ticket = { ...resolvedTicket, ...state };
    supportChatApi.getEscalationHistory.mockResolvedValue([reviewTicket, ticket]);
    supportChatApi.getEscalationDetail.mockImplementation(async (id) => (
      id === reviewTicket.id
        ? { questionEscalation: reviewTicket }
        : { questionEscalation: ticket, latestMentorAnswer: { answer: 'Servlet xử lý HTTP request.' } }
    ));
    renderSupportPage();
    expect(await screen.findByText(reviewTicket.mentorAnswer)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Servlet là gì/ }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Student chat' })).not.toBeInTheDocument();
      expect(screen.getByText('Servlet xử lý HTTP request.')).toBeVisible();
    });
    expect(screen.getByRole('heading', { name: 'Hỗ trợ từ giảng viên' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Servlet là gì/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Kế thừa trong Java/ }));
    expect(await screen.findByText(reviewTicket.mentorAnswer)).toBeVisible();
  });

  it('keeps the support page open when its first ticket is already resolved', async () => {
    const ticket = { ...resolvedTicket, status: 'RESOLVED_INDEXED' };
    supportChatApi.getEscalationHistory.mockResolvedValue([ticket]);
    supportChatApi.getEscalationDetail.mockResolvedValue({
      questionEscalation: ticket,
      latestMentorAnswer: { answer: 'Câu trả lời đã được duyệt.' },
    });
    renderSupportPage();

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Student chat' })).not.toBeInTheDocument();
      expect(screen.getByText('Câu trả lời đã được duyệt.')).toBeVisible();
    });
    expect(screen.getByRole('heading', { name: 'Hỗ trợ từ giảng viên' })).toBeVisible();
  });

  it('opens the ticket in the URL instead of the newest ticket, and keeps it selected while filtering', async () => {
    const ticket = { ...resolvedTicket, status: 'RESOLVED_INDEXED', mentorAnswer: 'Phản hồi đúng ticket.' };
    supportChatApi.getEscalationHistory.mockResolvedValue([reviewTicket, ticket]);
    supportChatApi.getEscalationDetail.mockResolvedValue({ questionEscalation: ticket });
    renderSupportPage('/student/mentor-review?ticket=ticket-resolved');

    expect(await screen.findByText(ticket.mentorAnswer)).toBeVisible();
    expect(screen.getByRole('button', { name: /Servlet là gì/ })).toHaveAttribute('aria-pressed', 'true');
    expect(supportChatApi.getEscalationDetail).not.toHaveBeenCalledWith(reviewTicket.id, expect.anything());
    fireEvent.change(screen.getByPlaceholderText('Tìm theo câu hỏi, môn hoặc lớp'), { target: { value: 'không khớp' } });
    expect(await screen.findByText('Không tìm thấy yêu cầu phù hợp')).toBeVisible();
    expect(screen.getByText(ticket.mentorAnswer)).toBeVisible();
    expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent('?ticket=ticket-resolved');
  });

  it('loads a new ticket directly even before it appears in history', async () => {
    supportChatApi.getEscalationHistory.mockResolvedValue([]);
    supportChatApi.getEscalationDetail.mockResolvedValue({
      questionEscalation: { ...resolvedTicket, status: 'COMPLETED', mentorAnswer: 'Phản hồi mới nhất.' },
    });
    renderSupportPage('/student/mentor-review?ticket=ticket-resolved');

    expect(await screen.findByText('Phản hồi mới nhất.')).toBeVisible();
    expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent('?ticket=ticket-resolved');
  });

  it('shows a missing-ticket error instead of silently selecting another request', async () => {
    supportChatApi.getEscalationHistory.mockResolvedValue([reviewTicket]);
    supportChatApi.getEscalationDetail.mockRejectedValue(new Error('Không tìm thấy ticket này.'));
    renderSupportPage('/student/mentor-review?ticket=missing-ticket');

    expect(await screen.findByText('Không thể tải nội dung')).toBeVisible();
    expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent('?ticket=missing-ticket');
    expect(screen.queryByText(reviewTicket.mentorAnswer)).not.toBeInTheDocument();
  });
});
