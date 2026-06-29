import React from 'react';
import Toast from '../../components/Toast';
import { useUiStore } from '../store/uiStore';

export function ToastProvider({ children }) {
  const toastMessage = useUiStore((state) => state.toastMessage);
  const setToastMessage = useUiStore((state) => state.setToastMessage);

  return (
    <>
      {children}
      {toastMessage && (
        <Toast 
          message={toastMessage} 
          onClose={() => setToastMessage(null)} 
        />
      )}
    </>
  );
}
