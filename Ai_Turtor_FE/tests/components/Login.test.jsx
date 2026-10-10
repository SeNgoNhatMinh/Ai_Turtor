import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '../../src/features/auth/LoginPage';

describe('Login', () => {
  it('validates credentials before making a request', () => {
    const triggerToast = vi.fn();
    render(<LoginPage onLoginSuccess={vi.fn()} triggerToast={triggerToast} />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/ }));

    expect(triggerToast).toHaveBeenCalledWith('Mật khẩu phải có ít nhất 6 ký tự.');
  });

  it('shows only the login form', () => {
    render(<LoginPage onLoginSuccess={vi.fn()} triggerToast={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Chào mừng bạn quay lại' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Tạo tài khoản' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có tài khoản? Đăng ký')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Họ và tên')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng nhập bằng Google' })).toBeInTheDocument();
  });
});
