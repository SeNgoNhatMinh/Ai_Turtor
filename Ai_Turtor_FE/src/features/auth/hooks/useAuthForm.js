import { useRef, useState } from 'react';
import { authApi } from '../../../services/authApi';
import { getUserFacingError } from '../../../services/apiClient';
import { validateAuthForm } from '../../../utils/validators';

const SUBMIT_COOLDOWN_MS = 900;

export function useAuthForm({ onLoginSuccess, triggerToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const lastSubmitAtRef = useRef(0);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const now = Date.now();
    if (isLoading || now - lastSubmitAtRef.current < SUBMIT_COOLDOWN_MS) return;

    const validation = validateAuthForm({ email, password, isLoginView: true });
    if (!validation.ok) {
      triggerToast?.(validation.message);
      return;
    }

    lastSubmitAtRef.current = now;
    setIsLoading(true);

    try {
      const user = await authApi.login(validation.value.email, validation.value.password);
      triggerToast?.('Đăng nhập thành công.');
      onLoginSuccess?.(user);
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Đã xảy ra lỗi. Vui lòng thử lại.'));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    handleSubmit,
    isLoading,
    password,
    setEmail,
    setPassword,
  };
}
