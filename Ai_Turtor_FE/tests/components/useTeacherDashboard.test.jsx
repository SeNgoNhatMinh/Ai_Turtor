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
    teacherApi.getDashboard.mockResolvedValue({ classes: [], students: [] });
  });

  it('loads assigned classes from the teacher class endpoint without waiting on dashboard', async () => {
    teacherApi.getClassSections.mockResolvedValue([
      { courseId: 'AI101', classId: 'AI101-01', teacherId: 'teacher-1' },
    ]);

    const { result } = renderHook(() => useTeacherDashboard({
      teacherId: 'teacher-1',
      courseId: 'PRO192',
      classId: 'SE1833',
    }));

    await act(async () => result.current.loadTeacherDashboard());

    expect(teacherApi.getClassSections).toHaveBeenCalledWith('teacher-1');
    expect(result.current.classesList).toEqual(expect.arrayContaining([
      expect.objectContaining({
        courseId: 'AI101',
        classId: 'AI101-01',
        name: 'Lớp AI101-01',
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

  it('loads enrolled students for assigned classes via the teacher-accessible class-section API', async () => {
    teacherApi.getClassSections.mockResolvedValue([
      { courseId: 'PRO192', classId: 'SE1833', teacherId: 'teacher-1' },
    ]);
    teacherApi.getClassStudents.mockResolvedValue({
      students: [
        { studentId: 's1', studentName: 'An Nguyen', studentEmail: 'an@fpt.edu.vn', status: 'ACTIVE' },
      ],
    });

    const { result } = renderHook(() => useTeacherDashboard({
      teacherId: 'teacher-1',
      courseId: 'PRO192',
      classId: 'SE1833',
    }));

    await act(async () => result.current.loadTeacherDashboard());

    expect(teacherApi.getClassStudents).toHaveBeenCalledWith('PRO192', 'SE1833');
    expect(result.current.teacherStudents[0]).toEqual(expect.objectContaining({
      name: 'An Nguyen',
      email: 'an@fpt.edu.vn',
      status: 'ACTIVE',
    }));
    expect(result.current.classesList[0].details).toBe('1 sinh viên');
  });
});
