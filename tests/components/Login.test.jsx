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

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: '1' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Đăng nhập/ }).at(-1));

    expect(triggerToast).toHaveBeenCalledWith('Mật khẩu phải có ít nhất 6 ký tự.');
  });

  it('shows registration fields through the segmented control', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} triggerToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tạo tài khoản' }));
    expect(screen.getByLabelText('Họ và tên')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu phải có ít nhất 6 ký tự.')).toBeInTheDocument();
  });
});
