import { lazy, Suspense } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
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
      <span>Loading workspace...</span>
    </div>
  );
}

export default function WorkspaceRoute({ role, activeTab }) {
  const context = useOutletContext();
  const Workspace = workspaces[role];

  if (!Workspace) return null;
  if (context.currentUserRole !== 'admin' && context.currentUserRole !== role) {
    return <Navigate to={getHomeRouteForRole(context.currentUserRole)} replace />;
  }

  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <Workspace {...context.workspaceProps} activeTab={activeTab} />
    </Suspense>
  );
}
