import { useEffect, useState } from 'react';

function readThemeMode() {
  if (typeof document === 'undefined') return 'light';
  return document.body.classList.contains('theme-dark') ? 'dark' : 'light';
}

export default function useThemeMode() {
  const [themeMode, setThemeMode] = useState(readThemeMode);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const update = () => setThemeMode(readThemeMode());
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    update();

    return () => observer.disconnect();
  }, []);

  return themeMode;
}
