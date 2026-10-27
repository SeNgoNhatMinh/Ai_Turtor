import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LogRocket from 'logrocket'
import LogRocketReact from 'logrocket-react'
import './index.css'
import AppProviders from './app/AppProviders.jsx'
import AppRouter from './app/AppRouter.jsx'

const LOGROCKET_APP_ID = import.meta.env.VITE_LOGROCKET_APP_ID;
if (LOGROCKET_APP_ID) {
  LogRocket.init(LOGROCKET_APP_ID, {
    release: typeof __APP_COMMIT_HASH__ === 'string' ? __APP_COMMIT_HASH__ : undefined,
  });
  const setupLogRocketReact = typeof LogRocketReact === 'function' ? LogRocketReact : LogRocketReact?.default;
  if (setupLogRocketReact) setupLogRocketReact(LogRocket);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
