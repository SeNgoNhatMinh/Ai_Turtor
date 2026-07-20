import { ConfigProvider } from 'antd';
import { getFptTheme } from '../../theme/fptTheme';
import AuthedLayout from './AuthedLayout';

export default function ThemedAuthedLayout({ isDarkMode, children, ...layoutProps }) {
  return (
    <ConfigProvider theme={getFptTheme(isDarkMode)}>
      <AuthedLayout {...layoutProps} isDarkMode={isDarkMode}>
        {children}
      </AuthedLayout>
    </ConfigProvider>
  );
}
