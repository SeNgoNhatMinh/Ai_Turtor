import { useEffect } from 'react';
import AdminPortal from '../../pages/AdminPortal';
import { useAdminRuntimeController } from '../../hooks/useAdminRuntimeController';

export default function AdminWorkspace({ activeTab, currentUser, triggerToast }) {
  const runtime = useAdminRuntimeController({ triggerToast });

  useEffect(() => {
    if (activeTab !== 'admin-dashboard') return;
    runtime.loadAdminStats();
    // Admin runtime loaders are intentionally scoped to the visible route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <AdminPortal
      activeTab={activeTab}
      adminStats={runtime.adminStats}
      diagnosticsOutput={runtime.diagnosticsOutput}
      isDiagnosticsRunning={runtime.isDiagnosticsRunning}
      runDiagnostics={runtime.runDiagnostics}
      handleAdminImport={runtime.handleAdminImport}
      triggerToast={triggerToast}
      currentUser={currentUser}
    />
  );
}
