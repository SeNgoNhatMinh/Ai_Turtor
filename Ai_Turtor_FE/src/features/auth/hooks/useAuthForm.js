import { useRef, useState } from 'react';
import { authApi } from '../../../services/authApi';
import { getUserFacingError } from '../../../services/apiClient';
import { validateAuthForm, validateEmail } from '../../../utils/validators';

const SUBMIT_COOLDOWN_MS = 900;

export function useAuthForm({ onLoginSuccess, triggerToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const lastSubmitAtRef = useRef(0);

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    clearFieldError('email');
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    clearFieldError('password');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const now = Date.now();
    if (isLoading || now - lastSubmitAtRef.current < SUBMIT_COOLDOWN_MS) return;

    const validation = validateAuthForm({ email, password, isLoginView: true });
    if (!validation.ok) {
      const emailCheck = validateEmail(email);
      if (!emailCheck.ok) {
        setFieldErrors({ email: emailCheck.message });
      } else {
        setFieldErrors({ password: validation.message });
      }
      triggerToast?.(validation.message, 'error');
      return;
    }

    setFieldErrors({});
    lastSubmitAtRef.current = now;
    setIsLoading(true);

    try {
      const user = await authApi.login(validation.value.email, validation.value.password);
      triggerToast?.('Đăng nhập thành công.');
      onLoginSuccess?.(user);
    } catch (error) {
      const message = getUserFacingError(error, 'Đã xảy ra lỗi. Vui lòng thử lại.');
      setFieldErrors({ form: message });
      triggerToast?.(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    fieldErrors,
    handleSubmit,
    isLoading,
    password,
    setEmail: handleEmailChange,
    setPassword: handlePasswordChange,
  };
}
