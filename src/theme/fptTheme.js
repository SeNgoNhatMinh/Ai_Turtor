import { theme } from 'antd';

export const fptColors = {
  primary: '#F37021',
  primaryDark: '#D85F16',
  background: '#FFF7F0',
  surface: '#FFFFFF',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#F3D2BC',
  darkBackground: '#000000',
  darkSurface: '#0F0F0F',
};

export const getFptTheme = (isDarkMode = false) => ({
  algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: fptColors.primary,
    colorInfo: fptColors.primary,
    colorLink: fptColors.primary,
    colorBgLayout: isDarkMode ? fptColors.darkBackground : fptColors.background,
    colorBgContainer: isDarkMode ? fptColors.darkSurface : fptColors.surface,
    colorBgElevated: isDarkMode ? '#171717' : fptColors.surface,
    colorBgSpotlight: isDarkMode ? '#1F1F1F' : fptColors.surface,
    colorText: isDarkMode ? '#F9FAFB' : fptColors.text,
    colorTextSecondary: isDarkMode ? '#D1D5DB' : fptColors.muted,
    colorBorder: isDarkMode ? '#2A2A2A' : fptColors.border,
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
