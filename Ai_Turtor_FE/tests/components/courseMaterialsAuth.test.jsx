import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourseMaterialsController } from '../../src/hooks/useCourseMaterialsController';
import { materialsApi } from '../../src/services/materialsApi';

vi.mock('../../src/services/materialsApi', () => ({
  materialsApi: { getStudentClassMaterials: vi.fn() },
}));
vi.mock('../../src/features/realtime/realtimeContext', () => ({
  useRealtimeEvent: vi.fn(),
  useRealtimeReconnect: vi.fn(),
}));

const scope = { studentId: 'student-1', courseId: 'PRJ301', classId: 'SE1832' };

describe('student materials authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    materialsApi.getStudentClassMaterials.mockResolvedValue({ materials: [] });
  });

  it('allows the materials page to recover an invalid login session', async () => {
    const { result } = renderHook(() => useCourseMaterialsController(scope));
    await act(() => result.current.loadCourseMaterials());
    expect(materialsApi.getStudentClassMaterials).toHaveBeenCalledWith(
      'student-1', 'PRJ301', 'SE1832',
      expect.objectContaining({ skipUnauthorizedRedirect: false }),
    );
  });

  it('preserves the session for optional chat background loading', async () => {
    const { result } = renderHook(() => useCourseMaterialsController({
      ...scope, skipUnauthorizedRedirect: true,
    }));
    await act(() => result.current.loadCourseMaterials());
    expect(materialsApi.getStudentClassMaterials).toHaveBeenCalledWith(
      'student-1', 'PRJ301', 'SE1832',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );
  });
});
