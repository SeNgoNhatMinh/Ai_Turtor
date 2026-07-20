import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeacherDashboard } from '../../src/features/teacher/dashboard/useTeacherDashboard';
import { teacherApi } from '../../src/services/teacherApi';

vi.mock('../../src/services/teacherApi', () => ({
  teacherApi: {
    getDashboard: vi.fn(),
    getClassSections: vi.fn(),
    getClassStudents: vi.fn(),
  },
}));

describe('useTeacherDashboard class assignment loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teacherApi.getClassStudents.mockResolvedValue({ students: [] });
  });

  it('loads the complete teacher class scope without stale course filters', async () => {
    teacherApi.getDashboard.mockResolvedValue({
      classes: [{ courseId: 'AI101', classId: 'AI101-01', teacherId: 'teacher-1' }],
      students: [],
    });

    const { result } = renderHook(() => useTeacherDashboard({
      teacherId: 'teacher-1',
      courseId: 'PRO192',
      classId: 'SE1833',
    }));

    await act(async () => result.current.loadTeacherDashboard());

    expect(teacherApi.getDashboard).toHaveBeenCalledWith('teacher-1');
    expect(result.current.classesList).toEqual(expect.arrayContaining([
      expect.objectContaining({
        courseId: 'AI101',
        classId: 'AI101-01',
        name: 'Class AI101-01',
      }),
    ]));
  });

  it('uses the teacher-authorized class endpoint when dashboard loading fails', async () => {
    teacherApi.getDashboard.mockRejectedValue(new Error('Dashboard unavailable'));
    teacherApi.getClassSections.mockResolvedValue([
      { courseId: 'PRO192', classId: 'SE1833', teacherId: 'teacher-1' },
    ]);

    const { result } = renderHook(() => useTeacherDashboard({
      teacherId: 'teacher-1',
      courseId: '',
      classId: '',
    }));

    await act(async () => result.current.loadTeacherDashboard());

    expect(teacherApi.getClassSections).toHaveBeenCalledWith('teacher-1');
    expect(result.current.classesList[0]).toEqual(expect.objectContaining({
      courseId: 'PRO192',
      classId: 'SE1833',
    }));
  });
});
