import React from 'react';
import { AuthProvider } from './AuthProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastProvider';
import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
