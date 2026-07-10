import { useCallback, useState } from 'react';
import { authApi } from '../services/authApi';
import { validateAuthForm } from '../utils/validators';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const login = useCallback(async ({ email, password }) => {
    const validation = validateAuthForm({ email, password, isLoginView: true });
    if (!validation.ok) throw new Error(validation.message);
    setIsAuthenticating(true);
    try {
      const nextUser = await authApi.login(validation.value.email, validation.value.password);
      if (nextUser.token) {
        window.localStorage.setItem('ai_tutor_jwt', nextUser.token);
      }
      setUser(nextUser);
      return nextUser;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const register = useCallback(async ({ email, password, fullName }) => {
    const validation = validateAuthForm({ email, password, fullName, isLoginView: false });
    if (!validation.ok) throw new Error(validation.message);
    setIsAuthenticating(true);
    try {
      const nextUser = await authApi.register(validation.value);
      if (nextUser.token) {
        window.localStorage.setItem('ai_tutor_jwt', nextUser.token);
      }
      return nextUser;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem('ai_tutor_jwt');
    setUser(null);
  }, []);

  return { user, setUser, login, register, logout, isAuthenticating };
}
