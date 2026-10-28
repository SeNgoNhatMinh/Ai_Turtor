import { useCallback, useEffect, useRef, useState } from 'react';

export function useToastMessage(durationMs = 3500) {
  const [toastMessage, setToastMessage] = useState(null);
  const timeoutRef = useRef(null);

  const clearToast = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToastMessage(null);
  }, []);

  const triggerToast = useCallback((message, type = 'success') => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    const payload = typeof message === 'object' && message !== null
      ? message
      : { text: message, type };
    setToastMessage(payload);
    timeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      timeoutRef.current = null;
    }, durationMs);
  }, [durationMs]);

  const triggerErrorToast = useCallback((message) => {
    triggerToast(message, 'error');
  }, [triggerToast]);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  return {
    toastMessage,
    setToastMessage,
    triggerToast,
    triggerErrorToast,
    clearToast,
  };
}
