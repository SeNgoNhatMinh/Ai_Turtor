import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppTabs from '../../src/components/common/AppTabs';

describe('AppTabs', () => {
  it('keeps Ant Tabs semantics and applies the shared project style', () => {
    const { container } = render(
      <AppTabs
        items={[
          { key: 'terms', label: 'Học kỳ', children: <div>Nội dung học kỳ</div> },
          { key: 'classes', label: 'Lớp học phần', children: <div>Nội dung lớp</div> },
        ]}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Học kỳ' })).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelector('.ant-tabs-nav-list')).toBeInTheDocument();
    expect(container.querySelector('.app-section-tabs')).toBeInTheDocument();
  });
});

