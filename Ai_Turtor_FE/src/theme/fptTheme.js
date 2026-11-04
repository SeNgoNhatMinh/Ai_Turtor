import { theme } from 'antd';

// Keep the product palette in one place. CSS mirrors these values in
// styles/tokens.css so both Ant Design and feature-owned styles share the
// same visual language without adding another runtime styling library.
export const FPT_COLORS = Object.freeze({
  orange: '#F37021',
  action: '#C24E0C',
  actionHover: '#A9450B',
  actionActive: '#873608',
  navy: '#001B3D',
  navySoft: '#0B3B82',
  blue: '#0066B3',
  green: '#168A42',
  red: '#D92D20',
  warning: '#B54708',
  background: '#F4F7FC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F8FAFC',
  text: '#172033',
  textSecondary: '#526071',
  textMuted: '#667085',
  border: '#DDE4ED',
  focus: '#F37021',
  darkBackground: '#090D14',
  darkSurface: '#111827',
  darkSurfaceElevated: '#182131',
  darkBorder: '#344054',
});

export const ROLE_THEMES = Object.freeze({
  student: Object.freeze({
    primary: FPT_COLORS.navySoft,
    primaryHover: FPT_COLORS.navy,
    primaryActive: '#00142E',
    link: FPT_COLORS.blue,
    soft: '#EAF2FB',
    rowHover: '#F3F7FC',
    focus: 'rgba(11, 59, 130, 0.24)',
  }),
  teacher: Object.freeze({
    primary: '#C2410C',
    primaryHover: '#9A3412',
    primaryActive: '#7C2D12',
    link: '#A33A0A',
    soft: '#FFEDD5',
    rowHover: '#FFF7ED',
    focus: 'rgba(194, 65, 12, 0.25)',
  }),
  senior: Object.freeze({
    primary: '#6D28D9',
    primaryHover: '#5B21B6',
    primaryActive: '#4C1D95',
    link: '#5B21B6',
    soft: '#EDE9FE',
    rowHover: '#F7F3FF',
    focus: 'rgba(109, 40, 217, 0.24)',
  }),
  admin: Object.freeze({
    primary: '#0F766E',
    primaryHover: '#115E59',
    primaryActive: '#134E4A',
    link: '#0F6B64',
    soft: '#CCFBF1',
    rowHover: '#F0FDFA',
    focus: 'rgba(15, 118, 110, 0.24)',
  }),
});

export function getRoleTheme(role) {
  const normalized = String(role || 'student').trim().toLowerCase().replace('_mentor', '');
  return ROLE_THEMES[normalized] || ROLE_THEMES.student;
}

export const getFptTheme = (isDarkMode = false, prefersReducedMotion = false, activeRole = 'student') => {
  const roleTheme = getRoleTheme(activeRole);

  return ({
  algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    // Let AntD disable its own motion through its supported token. Forcing
    // transition-duration globally breaks rc-trigger popup positioning.
    motion: !prefersReducedMotion,
    colorPrimary: roleTheme.primary,
    colorPrimaryHover: roleTheme.primaryHover,
    colorPrimaryActive: roleTheme.primaryActive,
    colorInfo: FPT_COLORS.blue,
    colorSuccess: FPT_COLORS.green,
    colorWarning: FPT_COLORS.warning,
    colorError: FPT_COLORS.red,
    colorLink: isDarkMode ? roleTheme.soft : roleTheme.link,
    colorLinkHover: isDarkMode ? '#FFFFFF' : roleTheme.primaryHover,
    colorBgLayout: isDarkMode ? FPT_COLORS.darkBackground : FPT_COLORS.background,
    colorBgContainer: isDarkMode ? FPT_COLORS.darkSurface : FPT_COLORS.surface,
    colorBgElevated: isDarkMode ? FPT_COLORS.darkSurfaceElevated : FPT_COLORS.surface,
    // Tooltip uses this as background and colorTextLightSolid (white) as text.
    // A white spotlight in light mode made the bubble look empty.
    colorBgSpotlight: isDarkMode ? '#1F1F1F' : '#202123',
    colorText: isDarkMode ? '#F8FAFC' : FPT_COLORS.text,
    colorTextSecondary: isDarkMode ? '#CBD5E1' : FPT_COLORS.textSecondary,
    colorTextTertiary: isDarkMode ? '#94A3B8' : FPT_COLORS.textMuted,
    colorBorder: isDarkMode ? FPT_COLORS.darkBorder : FPT_COLORS.border,
    colorBorderSecondary: isDarkMode ? '#263244' : '#E8EDF3',
    fontFamily: 'Inter, "Segoe UI Variable Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 14,
    controlHeight: 40,
    controlHeightLG: 46,
    controlHeightSM: 32,
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    boxShadow: isDarkMode ? '0 8px 24px rgba(0, 0, 0, 0.28)' : '0 8px 24px rgba(15, 23, 42, 0.05)',
  },
  components: {
    Button: {
      primaryShadow: 'none',
      fontWeight: 650,
      defaultBorderColor: isDarkMode ? FPT_COLORS.darkBorder : FPT_COLORS.border,
    },
    Menu: {
      itemSelectedBg: isDarkMode ? '#1F1F1F' : '#ECECEC',
      itemSelectedColor: FPT_COLORS.action,
      itemHoverColor: isDarkMode ? '#FFFFFF' : '#111827',
    },
    Tabs: {
      itemSelectedColor: isDarkMode ? '#FFFFFF' : '#202123',
      itemHoverColor: isDarkMode ? '#FFFFFF' : '#202123',
      inkBarColor: isDarkMode ? '#FFFFFF' : '#202123',
    },
    Input: {
      activeBorderColor: roleTheme.primary,
      hoverBorderColor: roleTheme.primary,
      activeShadow: `0 0 0 3px ${roleTheme.focus}`,
    },
    Select: {
      activeBorderColor: roleTheme.primary,
      hoverBorderColor: roleTheme.primary,
      activeOutlineColor: roleTheme.focus,
    },
    Table: {
      headerBg: isDarkMode ? '#172033' : FPT_COLORS.surfaceSubtle,
      headerColor: isDarkMode ? '#F8FAFC' : FPT_COLORS.navy,
      rowHoverBg: isDarkMode ? '#172033' : roleTheme.rowHover,
      borderColor: isDarkMode ? FPT_COLORS.darkBorder : FPT_COLORS.border,
    },
    Upload: {
      colorPrimaryHover: roleTheme.primaryHover,
    },
    Alert: {
      withDescriptionPadding: '14px 16px',
    },
  },
  });
};
