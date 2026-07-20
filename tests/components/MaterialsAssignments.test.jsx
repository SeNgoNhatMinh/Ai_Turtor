import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MaterialsAssignments from '../../src/features/student/materials/MaterialsAssignmentsView';

const baseProps = {
  assignments: [],
  selectedAssignment: null,
  setSelectedAssignment: vi.fn(),
  studentSubmissionFile: null,
  setStudentSubmissionFile: vi.fn(),
  studentSubmissionNote: '',
  setStudentSubmissionNote: vi.fn(),
  onStudentSubmit: vi.fn(),
  onDownloadAssignment: vi.fn(),
  courseMaterials: [],
  courseId: 'AI101',
  classId: 'AI101-01',
  courseOptions: [
    { value: 'OOP', label: 'OOP - Object-Oriented Programming' },
    { value: 'AI101', label: 'AI101 - Artificial Intelligence' },
  ],
  onCourseChange: vi.fn(),
};

describe('MaterialsAssignments course context', () => {
  it('shows assignments for the visible course and exposes course switching', async () => {
    const onCourseChange = vi.fn();
    render(
      <MaterialsAssignments
        {...baseProps}
        onCourseChange={onCourseChange}
        assignments={[{
          id: 'assignment-1',
          title: 'test 1',
          courseId: 'AI101',
          classId: 'AI101-01',
          assignmentType: 'ASSIGNMENT',
          targetType: 'ALL_CLASS',
        }]}
      />,
    );

    expect(screen.getByText('test 1')).toBeVisible();
    expect(screen.getByText('AI101-01')).toBeVisible();

    const courseSelect = screen.getByRole('combobox', { name: 'Môn học của bài tập' });
    fireEvent.mouseDown(courseSelect);
    fireEvent.click(await screen.findByText('OOP - Object-Oriented Programming'));

    expect(onCourseChange).toHaveBeenCalledWith('OOP', expect.anything());
  });

  it('explains that an empty list is scoped to the selected course', () => {
    render(<MaterialsAssignments {...baseProps} />);

    expect(screen.getByText('Chưa có bài tập được xuất bản cho AI101.')).toBeVisible();
  });
});
