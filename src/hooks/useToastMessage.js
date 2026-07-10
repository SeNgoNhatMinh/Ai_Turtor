import { useCallback, useRef, useState } from 'react';

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

  const triggerToast = useCallback((message) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setToastMessage(message);
    timeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      timeoutRef.current = null;
    }, durationMs);
  }, [durationMs]);

  return {
    toastMessage,
    setToastMessage,
    triggerToast,
    clearToast,
  };
}
