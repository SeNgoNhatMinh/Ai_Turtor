import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAuthSession } from '../../src/features/auth/hooks/useAuthSession';

function createToken(claims) {
  const encode = (value) => window.btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.signature`;
}

describe('useAuthSession role recovery', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('repairs an old STUDENT session using the role in JWT', () => {
    window.localStorage.setItem('ai_tutor_jwt', createToken({ role: 'ADMIN' }));
    window.sessionStorage.setItem('ai-tutor:current-user', JSON.stringify({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'STUDENT',
    }));

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.currentUser.role).toBe('ADMIN');
    expect(result.current.currentUserRole).toBe('admin');
  });

  it('discards an unverified legacy session without a valid JWT role', () => {
    window.sessionStorage.setItem('ai-tutor:current-user', JSON.stringify({
      userId: 'teacher-1',
      role: 'STUDENT',
    }));

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.currentUser).toBeNull();
  });

  it('keeps a verified explicit teacher role when a legacy token is not JWT shaped', () => {
    window.localStorage.setItem('ai_tutor_jwt', 'legacy-token');
    const { result } = renderHook(() => useAuthSession());

    act(() => {
      result.current.completeLogin({
        userId: 'teacher-1',
        role: 'TEACHER',
        authRoleVerified: true,
      });
    });

    expect(result.current.currentUser.role).toBe('TEACHER');
    expect(result.current.currentUserRole).toBe('teacher');
  });
});
