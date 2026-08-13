import { theme } from 'antd';

const fptColors = {
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

export const getFptTheme = (isDarkMode = false, prefersReducedMotion = false) => ({
  algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    // Let AntD disable its own motion through its supported token. Forcing
    // transition-duration globally breaks rc-trigger popup positioning.
    motion: !prefersReducedMotion,
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
    borderRadiusLG: 10,
    boxShadow: isDarkMode ? '0 8px 24px rgba(0, 0, 0, 0.28)' : '0 8px 24px rgba(15, 23, 42, 0.05)',
  },
  components: {
    Button: {
      primaryShadow: 'none',
    },
    Menu: {
      itemSelectedBg: isDarkMode ? '#1F1F1F' : '#ECECEC',
      itemSelectedColor: fptColors.primary,
      itemHoverColor: isDarkMode ? '#FFFFFF' : '#111827',
    },
    Tabs: {
      itemSelectedColor: isDarkMode ? '#FFFFFF' : '#202123',
      itemHoverColor: isDarkMode ? '#FFFFFF' : '#202123',
      inkBarColor: isDarkMode ? '#FFFFFF' : '#202123',
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
