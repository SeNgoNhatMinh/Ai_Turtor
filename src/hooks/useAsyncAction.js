import { useCallback, useRef, useState } from 'react';

export function useAsyncAction(action, { cooldownMs = 0 } = {}) {
  const [isRunning, setIsRunning] = useState(false);
  const lastRunAtRef = useRef(0);

  const run = useCallback(async (...args) => {
    const now = Date.now();
    if (isRunning) return undefined;
    if (cooldownMs && now - lastRunAtRef.current < cooldownMs) return undefined;

    lastRunAtRef.current = now;
    setIsRunning(true);
    try {
      return await action(...args);
    } finally {
      setIsRunning(false);
    }
  }, [action, cooldownMs, isRunning]);

  return { run, isRunning };
}
