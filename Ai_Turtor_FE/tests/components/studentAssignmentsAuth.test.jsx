import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/assignmentApi', () => ({
  assignmentApi: {
    getStudentAssignments: vi.fn(),
    getStudentSubmissions: vi.fn(),
  },
}));
vi.mock('../../src/features/realtime/realtimeContext', () => ({
  useRealtimeEvent: vi.fn(),
  useRealtimeReconnect: vi.fn(),
}));

import { useStudentAssignmentsController } from '../../src/hooks/useStudentAssignmentsController';
import { assignmentApi } from '../../src/services/assignmentApi';

describe('student assignment list authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assignmentApi.getStudentAssignments.mockResolvedValue([]);
    assignmentApi.getStudentSubmissions.mockResolvedValue([]);
  });

  it('keeps the current session when the materials page loads assignment data', async () => {
    const { result } = renderHook(() => useStudentAssignmentsController({
      studentId: 'student-1',
      courseId: 'PRJ301',
      skipUnauthorizedRedirect: true,
    }));

    await act(() => result.current.loadStudentAssignments());

    expect(assignmentApi.getStudentAssignments).toHaveBeenCalledWith(
      'student-1',
      'PRJ301',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );
    expect(assignmentApi.getStudentSubmissions).toHaveBeenCalledWith(
      'student-1',
      'PRJ301',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );
  });
});
