import { theme } from 'antd';

export const fptColors = {
  primary: '#F37021',
  primaryDark: '#C85A1B',
  link: '#374151',
  background: '#F7F7F5',
  surface: '#FFFFFF',
  text: '#202123',
  muted: '#6E6E73',
  border: '#E5E5E0',
  darkBackground: '#000000',
  darkSurface: '#0F0F0F',
};

export const getFptTheme = (isDarkMode = false) => ({
  algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: fptColors.primary,
    colorInfo: '#3B82F6',
    colorLink: fptColors.link,
    colorBgLayout: isDarkMode ? fptColors.darkBackground : fptColors.background,
    colorBgContainer: isDarkMode ? fptColors.darkSurface : fptColors.surface,
    colorBgElevated: isDarkMode ? '#171717' : fptColors.surface,
    colorBgSpotlight: isDarkMode ? '#1F1F1F' : fptColors.surface,
    colorText: isDarkMode ? '#F9FAFB' : fptColors.text,
    colorTextSecondary: isDarkMode ? '#D1D5DB' : fptColors.muted,
    colorBorder: isDarkMode ? '#2A2A2A' : fptColors.border,
    borderRadius: 8,
    boxShadow: isDarkMode ? '0 12px 30px rgba(0, 0, 0, 0.32)' : '0 12px 30px rgba(15, 23, 42, 0.06)',
  },
  components: {
    Button: {
      primaryShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
    },
    Menu: {
      itemSelectedBg: isDarkMode ? '#1F1F1F' : '#ECECEC',
      itemSelectedColor: fptColors.primary,
      itemHoverColor: isDarkMode ? '#FFFFFF' : '#111827',
    },
    Tabs: {
      itemSelectedColor: fptColors.primary,
      inkBarColor: fptColors.primary,
    },
    Input: {
      activeBorderColor: fptColors.primary,
      hoverBorderColor: fptColors.primary,
    },
    Upload: {
      colorPrimaryHover: fptColors.primaryDark,
    },
  },
});
