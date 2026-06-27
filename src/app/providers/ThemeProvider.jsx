import React, { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { getFptTheme } from '../../theme/fptTheme';
import { useUiStore } from '../store/uiStore';

export function ThemeProvider({ children }) {
  const isDarkMode = useUiStore((state) => state.isDarkMode);

  useEffect(() => {
    document.body.classList.toggle('theme-dark', isDarkMode);
    document.body.classList.toggle('theme-light', !isDarkMode);

    return () => {
      document.body.classList.remove('theme-dark', 'theme-light');
    };
  }, [isDarkMode]);

  return (
    <ConfigProvider theme={getFptTheme(isDarkMode)}>
      {children}
    </ConfigProvider>
  );
}
