import { lazy, Suspense } from 'react';

const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./admin/AdminUsers'));
const AdminAcademic = lazy(() => import('./admin/AdminAcademic'));

function AdminTabFallback() {
  return <div className="portal-loading" role="status">Loading workspace...</div>;
}

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
      <Suspense fallback={<AdminTabFallback />}>
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
      </Suspense>
    </div>
  );
}

export default AdminPortal;
