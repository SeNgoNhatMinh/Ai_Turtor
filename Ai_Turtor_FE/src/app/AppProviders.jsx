import { QueryClientProvider } from '@tanstack/react-query';
import AppErrorBoundary from './AppErrorBoundary';
import { appQueryClient } from './queryClient';

export default function AppProviders({ children }) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={appQueryClient}>
        {children}
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
