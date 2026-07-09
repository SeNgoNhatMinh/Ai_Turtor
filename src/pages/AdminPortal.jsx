import React from 'react';
import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import AdminAcademic from './admin/AdminAcademic';

/**
 * AdminPortal — Router chính cho Admin.
 * Mỗi tab được tách thành một sub-component riêng:
 *   admin/AdminDashboard.jsx  — Dashboard + Diagnostics
 *   admin/AdminUsers.jsx      — Users / Mentors / Support Requests
 *   admin/AdminAcademic.jsx   — Terms / Courses / Classes / Enrollments
 */
function AdminPortal({
  activeTab,
  adminStats,
  diagnosticsOutput,
  isDiagnosticsRunning,
  runDiagnostics,
  handleAdminImport,
  triggerToast,
  currentUser,
}) {
  const visibleTab = activeTab === 'admin-billing' ? 'admin-dashboard' : activeTab;

  return (
    <div style={{ padding: '0 24px 24px 24px' }}>
      {visibleTab === 'admin-dashboard' && (
        <AdminDashboard
          adminStats={adminStats}
          diagnosticsOutput={diagnosticsOutput}
          isDiagnosticsRunning={isDiagnosticsRunning}
          runDiagnostics={runDiagnostics}
        />
      )}

      {visibleTab === 'admin-users' && (
        <AdminUsers
          triggerToast={triggerToast}
          handleAdminImport={handleAdminImport}
        />
      )}

      {visibleTab === 'admin-academic' && (
        <AdminAcademic
          triggerToast={triggerToast}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

export default AdminPortal;
