import { BrowserRouter, Navigate, Route, Routes, useOutletContext } from 'react-router-dom';
import { normalizeAccountRole } from '../constants/roles';
import App from '../App.jsx';
import WorkspaceRoute from './workspaces/WorkspaceRoute';
import { appRoutes, getHomeRouteForRole, getRouteState } from './routes';
import { readLastPath } from '../utils/storage';

function resolveHomePath(context) {
  const accountRole = normalizeAccountRole(
    context.workspaceProps?.currentUser?.originalRole
      || context.workspaceProps?.currentUser?.role,
  );
  const roleHome = getHomeRouteForRole(accountRole || context.activeRole || context.currentUserRole);
  const lastPath = readLastPath();
  if (!lastPath || lastPath === '/' || lastPath.startsWith('/login')) return roleHome;

  const pathname = lastPath.split('?')[0] || '';
  const lastRoute = getRouteState(pathname);
  if (!lastRoute) return roleHome;

  const workspaceRole = context.currentUserRole || '';
  if (workspaceRole && workspaceRole !== 'admin' && lastRoute.role !== workspaceRole) {
    return roleHome;
  }
  return lastPath;
}

function HomeRedirect() {
  const context = useOutletContext();
  return <Navigate to={resolveHomePath(context)} replace />;
}

function LegacyExpertTrainingRedirect({ admin = false }) {
  const context = useOutletContext();
  const accountRole = normalizeAccountRole(
    context.workspaceProps?.currentUser?.originalRole
      || context.workspaceProps?.currentUser?.role,
  );
  if (admin || accountRole === 'ADMIN') return <Navigate to="/admin/reindex" replace />;
  if (accountRole === 'SENIOR_MENTOR') return <Navigate to="/senior/v2" replace />;
  return <Navigate to="/teacher/expert-tasks" replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          {appRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={(
                <WorkspaceRoute
                  role={route.role}
                  activeTab={route.tab}
                  allowedAccountRoles={route.allowedAccountRoles}
                />
              )}
            />
          ))}
          <Route path="/teacher/expert-training" element={<LegacyExpertTrainingRedirect />} />
          <Route path="/admin/expert-training" element={<LegacyExpertTrainingRedirect admin />} />
          <Route path="/admin/v2" element={<LegacyExpertTrainingRedirect admin />} />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
