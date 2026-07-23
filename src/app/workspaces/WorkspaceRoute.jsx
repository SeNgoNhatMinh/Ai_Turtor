import { lazy, Suspense } from 'react';
import { Button, Result } from 'antd';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { normalizeAccountRole } from '../../constants/roles';
import { getHomeRouteForRole } from '../routes';

const StudentWorkspace = lazy(() => import('./StudentWorkspace'));
const TeacherWorkspace = lazy(() => import('./TeacherWorkspace'));
const AdminWorkspace = lazy(() => import('./AdminWorkspace'));

const workspaces = {
  student: StudentWorkspace,
  teacher: TeacherWorkspace,
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
    <Result
      status="403"
      title="Không có quyền truy cập"
      subTitle="Tài khoản hiện tại không được phép sử dụng chức năng này."
      extra={<Button type="primary" onClick={() => navigate(homeRoute, { replace: true })}>Về trang chính</Button>}
    />
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
    return <ForbiddenPage homeRoute={getHomeRouteForRole(context.currentUserRole)} />;
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
