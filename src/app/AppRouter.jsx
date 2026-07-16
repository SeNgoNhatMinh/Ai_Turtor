import { BrowserRouter, Navigate, Route, Routes, useOutletContext } from 'react-router-dom';
import App from '../App.jsx';
import WorkspaceRoute from './workspaces/WorkspaceRoute';
import { appRoutes, getHomeRouteForRole } from './routes';

function HomeRedirect() {
  const context = useOutletContext();
  return <Navigate to={getHomeRouteForRole(context.activeRole || context.currentUserRole)} replace />;
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
              element={<WorkspaceRoute role={route.role} activeTab={route.tab} />}
            />
          ))}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
