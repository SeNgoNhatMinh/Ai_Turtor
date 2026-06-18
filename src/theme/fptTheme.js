import { theme } from 'antd';

export const fptColors = {
  primary: '#F37021',
  primaryDark: '#D85F16',
  background: '#FFF7F0',
  surface: '#FFFFFF',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#F3D2BC',
  darkBackground: '#161616',
  darkSurface: '#202020',
};

export const getFptTheme = (isDarkMode = false) => ({
  algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: fptColors.primary,
    colorInfo: fptColors.primary,
    colorLink: fptColors.primary,
    colorBgLayout: isDarkMode ? fptColors.darkBackground : fptColors.background,
    colorBgContainer: isDarkMode ? fptColors.darkSurface : fptColors.surface,
    colorText: isDarkMode ? '#F9FAFB' : fptColors.text,
    colorTextSecondary: isDarkMode ? '#D1D5DB' : fptColors.muted,
    colorBorder: isDarkMode ? '#3F3F46' : fptColors.border,
    borderRadius: 8,
    boxShadow: '0 12px 30px rgba(243, 112, 33, 0.12)',
  },
  components: {
    Button: {
      primaryShadow: '0 8px 18px rgba(243, 112, 33, 0.22)',
    },
    Menu: {
      itemSelectedBg: isDarkMode ? 'rgba(243, 112, 33, 0.2)' : '#FFF0E6',
      itemSelectedColor: fptColors.primary,
      itemHoverColor: fptColors.primaryDark,
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
