import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LearningProgress from '../../src/features/student/learning/LearningProgressView';

describe('LearningProgress', () => {
  it('separates learning information into clear categories', () => {
    render(
      <LearningProgress
        learnedTopics={['Servlet']}
        weakTopics={['JSP']}
        suggestions={[]}
        isSuggesting={false}
        refreshSuggestions={vi.fn()}
        studentId="student-1"
        courseId="PRJ301"
        classId="SE1832"
      />,
    );

    expect(screen.getByRole('tab', { name: 'Tổng quan' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'Kiến thức & gợi ý' }));
    expect(screen.getByText('Bộ nhớ học tập theo môn')).toBeVisible();
    expect(screen.getByText('Nội dung nên học tiếp')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Kế hoạch ôn tập' }));
    expect(screen.getByText('Kế hoạch cải thiện')).toBeVisible();
    expect(screen.getByText('Kế hoạch học theo môn')).toBeVisible();
  });
});
