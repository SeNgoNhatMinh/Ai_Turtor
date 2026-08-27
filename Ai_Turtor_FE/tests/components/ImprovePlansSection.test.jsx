import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ImprovePlansSection from '../../src/features/student/learning/ImprovePlansSection';

describe('ImprovePlansSection', () => {
  it('renders structured plan steps instead of legacy raw suggestion JSON', () => {
    const rawJson = '{"suggestions":[{"title":"Ôn JSP"}]}';

    render(
      <ImprovePlansSection
        plans={[{
          id: 'plan-1',
          status: 'ACTIVE',
          riskLevel: 'MEDIUM',
          planItems: [rawJson],
          structuredSuggestions: [
            {
              title: 'Ôn JSP',
              reason: 'Cần củng cố Servlet và JSP.',
              nextSteps: ['Viết servlet đơn giản.', 'Forward dữ liệu sang JSP.'],
            },
            {
              kind: 'note',
              title: 'Lưu ý từ AI Tutor',
              content: 'Chỉ học nội dung thuộc phạm vi môn.',
            },
          ],
        }]}
        latestPlan={null}
        loading={false}
        error=""
        completingPlanId=""
        hasContext
        onReload={vi.fn()}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText('Viết servlet đơn giản.')).toBeVisible();
    expect(screen.getByText('Forward dữ liệu sang JSP.')).toBeVisible();
    expect(screen.getByText('Chỉ học nội dung thuộc phạm vi môn.')).toBeVisible();
    expect(screen.queryByText(rawJson)).not.toBeInTheDocument();
  });
});
