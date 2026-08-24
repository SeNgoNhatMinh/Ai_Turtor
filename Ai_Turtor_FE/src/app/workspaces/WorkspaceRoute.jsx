import { lazy, Suspense } from 'react';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { normalizeAccountRole } from '../../constants/roles';
import { getHomeRouteForRole } from '../routes';
import './WorkspaceRoute.css';

const StudentWorkspace = lazy(() => import('./StudentWorkspace'));
const TeacherWorkspace = lazy(() => import('./TeacherWorkspace'));
const SeniorWorkspace = lazy(() => import('./SeniorWorkspace'));
const AdminWorkspace = lazy(() => import('./AdminWorkspace'));

const workspaces = {
  student: StudentWorkspace,
  teacher: TeacherWorkspace,
  senior: SeniorWorkspace,
  admin: AdminWorkspace,
};

function WorkspaceFallback() {
  return (
    <div className="workspace-route-loading" role="status" aria-live="polite">
      <span className="app-route-loading__spinner" aria-hidden="true" />
      <span>Đang tải không gian làm việc...</span>
    </div>
  );
}

function ForbiddenPage({ homeRoute }) {
  const navigate = useNavigate();
  return (
    <section className="workspace-forbidden" role="alert">
      <span className="workspace-forbidden__code" aria-hidden="true">403</span>
      <h1>Không có quyền truy cập</h1>
      <p>Tài khoản hiện tại không được phép sử dụng chức năng này.</p>
      <button type="button" onClick={() => navigate(homeRoute, { replace: true })}>
        Về trang chính
      </button>
    </section>
  );
}

export default function WorkspaceRoute({ role, activeTab, allowedAccountRoles = null }) {
  const context = useOutletContext();
  const Workspace = workspaces[role];
  const accountRole = normalizeAccountRole(
    context.workspaceProps?.currentUser?.originalRole
      || context.workspaceProps?.currentUser?.role,
  );

  if (!Workspace) return null;
  if (allowedAccountRoles?.length && !allowedAccountRoles.includes(accountRole)) {
    return <ForbiddenPage homeRoute={getHomeRouteForRole(accountRole)} />;
  }
  if (context.currentUserRole !== 'admin' && context.currentUserRole !== role) {
    return <Navigate to={getHomeRouteForRole(context.currentUserRole)} replace />;
  }

  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <Workspace {...context.workspaceProps} activeTab={activeTab} />
    </Suspense>
  );
}
