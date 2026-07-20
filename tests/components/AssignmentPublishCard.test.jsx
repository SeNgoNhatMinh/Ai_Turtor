import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AssignmentPublishCard from '../../src/features/teacher/materials/AssignmentPublishCard';

const classSection = {
  classId: '1833',
  classCode: 'SE1833',
  className: 'Software Engineering 1833',
  courseId: 'PRO192',
};

const createAssignmentState = (overrides = {}) => ({
  title: 'OOP exercise',
  setTitle: vi.fn(),
  description: '',
  setDescription: vi.fn(),
  classId: '1833',
  courseId: 'PRO192',
  type: 'ASSIGNMENT',
  setType: vi.fn(),
  maxScore: '10',
  setMaxScore: vi.fn(),
  deadline: '',
  setDeadline: vi.fn(),
  file: new File(['assignment'], 'oop.pdf', { type: 'application/pdf' }),
  setFile: vi.fn(() => true),
  targetType: 'ALL_CLASS',
  setTargetType: vi.fn(),
  targetStudents: '',
  setTargetStudents: vi.fn(),
  isPublishing: false,
  ...overrides,
});

describe('AssignmentPublishCard', () => {
  it('uses the backend classId while keeping classCode as display text', async () => {
    const onClassChange = vi.fn();
    render(
      <AssignmentPublishCard
        classesList={[classSection]}
        assignment={createAssignmentState({ classId: '' })}
        onClassChange={onClassChange}
        onCreate={vi.fn((event) => event.preventDefault())}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Assignment teaching class' }));
    fireEvent.click(await screen.findByText('Software Engineering 1833 · PRO192'));

    await waitFor(() => expect(onClassChange).toHaveBeenCalledWith(
      '1833',
      expect.objectContaining({ classId: '1833', courseId: 'PRO192' }),
    ));
  });

  it('explains why publishing is disabled', () => {
    render(
      <AssignmentPublishCard
        classesList={[classSection]}
        assignment={createAssignmentState({ file: null })}
        onClassChange={vi.fn()}
        onCreate={vi.fn((event) => event.preventDefault())}
      />,
    );

    expect(screen.getByText('Choose an assignment file.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish Assignment' })).toBeDisabled();
  });

  it('submits only when all required fields are valid', () => {
    const onCreate = vi.fn((event) => event.preventDefault());
    render(
      <AssignmentPublishCard
        classesList={[classSection]}
        assignment={createAssignmentState()}
        onClassChange={vi.fn()}
        onCreate={onCreate}
      />,
    );

    const publishButton = screen.getByRole('button', { name: 'Publish Assignment' });
    expect(publishButton).toBeEnabled();
    fireEvent.submit(publishButton.closest('form'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
