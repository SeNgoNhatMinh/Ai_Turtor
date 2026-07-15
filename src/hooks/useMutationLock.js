import { useCallback, useRef, useState } from 'react';

export function useMutationLock() {
  const locksRef = useRef(new Set());
  const [lockedKeys, setLockedKeys] = useState([]);

  const runLocked = useCallback(async (key, action) => {
    if (!key || locksRef.current.has(key)) return undefined;
    locksRef.current.add(key);
    setLockedKeys(Array.from(locksRef.current));
    try {
      return await action();
    } finally {
      locksRef.current.delete(key);
      setLockedKeys(Array.from(locksRef.current));
    }
  }, []);

  const isLocked = useCallback((key) => locksRef.current.has(key), []);

  return { runLocked, isLocked, lockedKeys };
}
