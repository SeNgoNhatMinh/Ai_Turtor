import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CachedAnswerPreview from '../../src/features/answer-cache/components/CachedAnswerPreview';

describe('CachedAnswerPreview', () => {
  it('renders the cached answer with the shared ChatGPT-style Markdown renderer', () => {
    render(
      <CachedAnswerPreview
        answer={'## Fibonacci\n\nDùng **memoization** để tránh tính lặp.\n\n```java\nreturn fib(n - 1) + fib(n - 2);\n```'}
      />,
    );

    expect(screen.getByText('AI Tutor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fibonacci' })).toBeInTheDocument();
    expect(screen.getByText('memoization').tagName).toBe('STRONG');
    expect(screen.getByText(/return fib/)).toBeInTheDocument();
  });
});
