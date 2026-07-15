import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AsyncState from '../../src/components/common/AsyncState';

describe('AsyncState', () => {
  it('announces loading state without rendering children', () => {
    render(<AsyncState loading loadingLabel="Loading quizzes"><div>Ready</div></AsyncState>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading quizzes');
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  it('renders a retryable friendly error', () => {
    const onRetry = vi.fn();
    render(<AsyncState error="The service is unavailable." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The service is unavailable.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders children when no async state is active', () => {
    render(<AsyncState><div>Ready content</div></AsyncState>);
    expect(screen.getByText('Ready content')).toBeInTheDocument();
  });
});
