import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { getFptTheme } from '../../theme/fptTheme';
import AuthedLayout from './AuthedLayout';

export default function ThemedAuthedLayout({ isDarkMode, children, ...layoutProps }) {
  return (
    <ConfigProvider locale={viVN} theme={getFptTheme(isDarkMode)}>
      <AuthedLayout {...layoutProps} isDarkMode={isDarkMode}>
        {children}
      </AuthedLayout>
    </ConfigProvider>
  );
}
