import { useEffect } from 'react';
import AdminDashboard from '../../../pages/admin/AdminDashboard';
import { useAdminDashboardController } from './useAdminDashboardController';

export default function AdminDashboardPage({ triggerToast }) {
  const dashboard = useAdminDashboardController({ triggerToast });
  const { loadAdminStats } = dashboard;

  useEffect(() => {
    loadAdminStats();
  }, [loadAdminStats]);

  return (
    <div className="admin-route-page">
      <AdminDashboard
        adminStats={dashboard.adminStats}
        diagnosticsOutput={dashboard.diagnosticsOutput}
        isDiagnosticsRunning={dashboard.isDiagnosticsRunning}
        runDiagnostics={dashboard.runDiagnostics}
      />
    </div>
  );
}
