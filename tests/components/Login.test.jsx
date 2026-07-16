import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../../src/features/auth/LoginPage';

vi.mock('../../src/components/RobotHeadMascot', () => ({
  default: () => <div aria-label="AI robot tutor saying the FPT learning slogan" />,
}));

describe('Login', () => {
  it('validates credentials before making a request', () => {
    const triggerToast = vi.fn();
    render(<LoginPage onLoginSuccess={vi.fn()} triggerToast={triggerToast} />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '1' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Sign in/ }).at(-1));

    expect(triggerToast).toHaveBeenCalledWith('Password must be at least 6 characters.');
  });

  it('shows registration fields through the segmented control', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} triggerToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Create account' }));
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument();
  });
});
