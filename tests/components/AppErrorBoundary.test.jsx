import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppErrorBoundary from '../../src/app/AppErrorBoundary';

describe('AppErrorBoundary', () => {
  it('shows a reference and can retry rendering', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function FlakyChild() {
      if (shouldThrow) throw new Error('Render failed');
      return <div>Recovered content</div>;
    }

    render(<AppErrorBoundary><FlakyChild /></AppErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent(/Error reference: FE-/);
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
