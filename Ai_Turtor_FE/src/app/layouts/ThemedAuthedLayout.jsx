import { useEffect, useState } from 'react';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { getFptTheme } from '../../theme/fptTheme';
import AuthedLayout from './AuthedLayout';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(reducedMotionQuery).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(reducedMotionQuery);
    const handleChange = (event) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

export default function ThemedAuthedLayout({ isDarkMode, children, ...layoutProps }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <ConfigProvider
      locale={viVN}
      theme={getFptTheme(isDarkMode, prefersReducedMotion)}
    >
      <AuthedLayout {...layoutProps} isDarkMode={isDarkMode}>
        {children}
      </AuthedLayout>
    </ConfigProvider>
  );
}
