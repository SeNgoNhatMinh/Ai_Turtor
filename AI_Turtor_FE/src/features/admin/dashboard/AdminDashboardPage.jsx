import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import { useAdminDashboardController } from './useAdminDashboardController';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';

export default function AdminDashboardPage({ triggerToast }) {
  const navigate = useNavigate();
  const dashboard = useAdminDashboardController({ triggerToast });
  const { loadAdminStats } = dashboard;

  useEffect(() => {
    loadAdminStats();
  }, [loadAdminStats]);

  return (
    <div className="portal-section admin-route-page">
      <PageHeader {...uiCopy.admin.dashboard} eyebrow="Quản trị hệ thống" />
      <AdminDashboard
        adminStats={dashboard.adminStats}
        diagnosticsOutput={dashboard.diagnosticsOutput}
        isDiagnosticsRunning={dashboard.isDiagnosticsRunning}
        runDiagnostics={dashboard.runDiagnostics}
        onNavigate={navigate}
      />
    </div>
  );
}
