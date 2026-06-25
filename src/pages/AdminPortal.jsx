import React from 'react';
import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import AdminAcademic from './admin/AdminAcademic';
import AdminBilling from './admin/AdminBilling';

/**
 * AdminPortal — Router chính cho Admin.
 * Mỗi tab được tách thành một sub-component riêng:
 *   admin/AdminDashboard.jsx  — Dashboard + Diagnostics
 *   admin/AdminUsers.jsx      — Users / Mentors / Support Requests
 *   admin/AdminAcademic.jsx   — Terms / Courses / Classes / Enrollments
 *   admin/AdminBilling.jsx    — Plans / Subscriptions
 */
function AdminPortal({
  activeTab,
  adminStats,
  diagnosticsOutput,
  isDiagnosticsRunning,
  runDiagnostics,
  adminPlans,
  handleAdminImport,
  triggerToast,
  currentUser,
}) {
  return (
    <div style={{ padding: '0 24px 24px 24px' }}>
      {activeTab === 'admin-dashboard' && (
        <AdminDashboard
          adminStats={adminStats}
          diagnosticsOutput={diagnosticsOutput}
          isDiagnosticsRunning={isDiagnosticsRunning}
          runDiagnostics={runDiagnostics}
        />
      )}

      {activeTab === 'admin-users' && (
        <AdminUsers
          triggerToast={triggerToast}
          handleAdminImport={handleAdminImport}
        />
      )}

      {activeTab === 'admin-academic' && (
        <AdminAcademic
          triggerToast={triggerToast}
          currentUser={currentUser}
        />
      )}

      {activeTab === 'admin-billing' && (
        <AdminBilling
          adminPlans={adminPlans}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}

export default AdminPortal;
