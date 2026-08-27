import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/apiClient', () => ({
  API_BASE_URL: '/api',
  request: vi.fn(),
}));

import { request } from '../../src/services/apiClient';
import { supportChatApi } from '../../src/services/supportChatApi';

describe('supportChatApi session safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue({ escalations: [] });
  });

  it('keeps the current session when support history or detail is unauthorized', async () => {
    await supportChatApi.getEscalationHistory('student 1');
    expect(request).toHaveBeenLastCalledWith(
      '/api/tutor/escalations/history?userId=student+1',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );

    await supportChatApi.getEscalationDetail('ticket 1');
    expect(request).toHaveBeenLastCalledWith(
      '/api/tutor/escalations/ticket%201',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );
  });

  it('keeps the current session while loading an existing support chat room', async () => {
    request.mockResolvedValue({ messages: [] });

    await supportChatApi.getHistory('room 1');
    expect(request).toHaveBeenLastCalledWith(
      '/api/chat/history?chatRoomId=room+1&page=0&size=100',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );

    await supportChatApi.getDetail('room 1');
    expect(request).toHaveBeenLastCalledWith(
      '/api/chat/detail?chatRoomId=room+1',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );
  });
});
