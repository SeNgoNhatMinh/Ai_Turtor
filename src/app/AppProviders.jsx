import AppErrorBoundary from './AppErrorBoundary';

export default function AppProviders({ children }) {
  return (
    <AppErrorBoundary>
      {children}
    </AppErrorBoundary>
  );
}
