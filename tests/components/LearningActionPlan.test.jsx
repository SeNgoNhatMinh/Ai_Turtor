import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LearningActionPlan from '../../src/features/student/learning/LearningActionPlan';

describe('LearningActionPlan', () => {
  it('turns learning memory into an ordered plan with real study actions', () => {
    const onStudy = vi.fn();
    const onCreateQuiz = vi.fn();

    render(
      <LearningActionPlan
        courseId="PRO192"
        learnedTopics={['Encapsulation']}
        weakTopics={['Inheritance']}
        suggestions={[{ title: 'Interfaces', priority: 'pinned' }]}
        hasContext
        onStudy={onStudy}
        onCreateQuiz={onCreateQuiz}
      />,
    );

    expect(screen.getByText('Course Action Plan')).toBeVisible();
    expect(screen.getByText('Recommended next step')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Interfaces' })).toBeVisible();
    expect(screen.getByText('Inheritance')).toBeVisible();
    expect(screen.getByText('Encapsulation')).toBeVisible();

    fireEvent.click(screen.getAllByRole('button', { name: /Study/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /Quiz/i })[0]);
    expect(onStudy).toHaveBeenCalledWith('Interfaces');
    expect(onCreateQuiz).toHaveBeenCalledWith('Interfaces');
  });

  it('disables learning mutations when course context or handlers are unavailable', () => {
    render(
      <LearningActionPlan
        courseId=""
        learnedTopics={[]}
        weakTopics={['Inheritance']}
        suggestions={[]}
        hasContext={false}
      />,
    );

    expect(screen.getByRole('button', { name: /Study/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Quiz/i })).toBeDisabled();
  });
});
