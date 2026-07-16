import { useRef, useState } from 'react';
import { authApi } from '../../../services/authApi';
import { getUserFacingError } from '../../../services/apiClient';
import { validateAuthForm } from '../../../utils/validators';

const SUBMIT_COOLDOWN_MS = 900;

export function useAuthForm({ onLoginSuccess, triggerToast }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const lastSubmitAtRef = useRef(0);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const now = Date.now();
    if (isLoading || now - lastSubmitAtRef.current < SUBMIT_COOLDOWN_MS) return;

    const validation = validateAuthForm({ email, password, fullName, isLoginView });
    if (!validation.ok) {
      triggerToast?.(validation.message);
      return;
    }

    lastSubmitAtRef.current = now;
    setIsLoading(true);

    try {
      if (isLoginView) {
        const user = await authApi.login(validation.value.email, validation.value.password);
        triggerToast?.('Signed in successfully.');
        onLoginSuccess?.(user);
        return;
      }

      await authApi.register(validation.value);
      triggerToast?.('Account created. Please sign in.');
      setIsLoginView(true);
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Something went wrong. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    fullName,
    handleSubmit,
    isLoading,
    isLoginView,
    password,
    setEmail,
    setFullName,
    setIsLoginView,
    setPassword,
  };
}
