import React from 'react';

export function AuthProvider({ children }) {
  // Currently, auth state and persistence is handled by useAuthStore.
  // In the future, this provider can handle token refresh, session validation, etc.
  return <>{children}</>;
}
