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

export const getFptTheme = (isDarkMode = false, prefersReducedMotion = false) => ({
  algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    // Let AntD disable its own motion through its supported token. Forcing
    // transition-duration globally breaks rc-trigger popup positioning.
    motion: !prefersReducedMotion,
    colorPrimary: FPT_COLORS.action,
    colorPrimaryHover: FPT_COLORS.actionHover,
    colorPrimaryActive: FPT_COLORS.actionActive,
    colorInfo: FPT_COLORS.blue,
    colorSuccess: FPT_COLORS.green,
    colorWarning: FPT_COLORS.warning,
    colorError: FPT_COLORS.red,
    colorLink: isDarkMode ? '#69B7EE' : FPT_COLORS.blue,
    colorLinkHover: isDarkMode ? '#91CAEF' : FPT_COLORS.navySoft,
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
      activeBorderColor: FPT_COLORS.action,
      hoverBorderColor: FPT_COLORS.action,
      activeShadow: '0 0 0 3px rgba(243, 112, 33, 0.14)',
    },
    Select: {
      activeBorderColor: FPT_COLORS.action,
      hoverBorderColor: FPT_COLORS.action,
      activeOutlineColor: 'rgba(243, 112, 33, 0.14)',
    },
    Table: {
      headerBg: isDarkMode ? '#172033' : FPT_COLORS.surfaceSubtle,
      headerColor: isDarkMode ? '#F8FAFC' : FPT_COLORS.navy,
      rowHoverBg: isDarkMode ? '#172033' : '#FFF8F3',
      borderColor: isDarkMode ? FPT_COLORS.darkBorder : FPT_COLORS.border,
    },
    Upload: {
      colorPrimaryHover: FPT_COLORS.actionHover,
    },
    Alert: {
      withDescriptionPadding: '14px 16px',
    },
  },
});
