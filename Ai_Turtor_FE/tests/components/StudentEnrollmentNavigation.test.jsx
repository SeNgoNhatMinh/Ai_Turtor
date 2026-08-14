import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudentDashboardPage from '../../src/features/student/dashboard/StudentDashboardPage';
import { useStudentEnrollmentOptions } from '../../src/hooks/useStudentEnrollmentOptions';
import { adminAcademicApi } from '../../src/services/adminAcademicApi';

vi.mock('../../src/services/adminAcademicApi', () => ({
  adminAcademicApi: {
    getStudentEnrollments: vi.fn(),
  },
}));

describe('student enrollment navigation', () => {
  it('keeps canonical enrollment context when the workspace remounts', async () => {
    const studentId = 'student-enrollment-cache-test';
    const enrollmentRecord = {
      studentId,
      courseId: 'PRJ301',
      classId: '1833',
      classCode: 'SE1833',
    };
    adminAcademicApi.getStudentEnrollments.mockResolvedValue([enrollmentRecord]);

    const first = renderHook(() => useStudentEnrollmentOptions({
      studentId,
      lookupIds: [],
      courseId: '',
      classId: '',
      setCourseId: vi.fn(),
      setClassId: vi.fn(),
    }));

    await act(async () => {
      await first.result.current.loadStudentEnrollments();
    });
    expect(first.result.current.hasStudentEnrollments).toBe(true);
    first.unmount();

    const setCourseId = vi.fn();
    const setClassId = vi.fn();
    const second = renderHook(() => useStudentEnrollmentOptions({
      studentId,
      lookupIds: [],
      courseId: 'PRJ301',
      classId: 'SE1833',
      setCourseId,
      setClassId,
    }));

    expect(second.result.current.hasLoadedStudentEnrollments).toBe(true);
    expect(second.result.current.hasStudentEnrollments).toBe(true);

    let context;
    await act(async () => {
      context = await second.result.current.ensureEnrollmentContext('prj301');
    });
    expect(context).toEqual({ courseId: 'PRJ301', classId: 'SE1833' });
    expect(setCourseId).toHaveBeenCalledWith('PRJ301');
    expect(setClassId).toHaveBeenCalledWith('SE1833');
  });

  it('opens AI chat only after a valid enrolled class is selected', async () => {
    const switchTab = vi.fn();
    const ensureEnrollmentContext = vi.fn().mockResolvedValue({
      courseId: 'PRJ301',
      classId: 'SE1833',
    });

    render(
      <StudentDashboardPage
        currentUser={{ fullName: 'Student A' }}
        courseId=""
        switchTab={switchTab}
        triggerToast={vi.fn()}
        enrollment={{
          studentEnrollments: [{ courseId: 'PRJ301', classCode: 'SE1833' }],
          ensureEnrollmentContext,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu học với AI/i }));

    await waitFor(() => {
      expect(ensureEnrollmentContext).toHaveBeenCalledWith('');
      expect(switchTab).toHaveBeenCalledWith('student-chat');
    });
  });

  it('does not enter chat when no canonical enrollment is available', async () => {
    const switchTab = vi.fn();
    const triggerToast = vi.fn();

    render(
      <StudentDashboardPage
        currentUser={{ fullName: 'Student A' }}
        courseId=""
        switchTab={switchTab}
        triggerToast={triggerToast}
        enrollment={{
          studentEnrollments: [],
          ensureEnrollmentContext: vi.fn().mockResolvedValue(null),
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu học với AI/i }));

    await waitFor(() => {
      expect(triggerToast).toHaveBeenCalled();
      expect(switchTab).not.toHaveBeenCalled();
    });
  });
});
