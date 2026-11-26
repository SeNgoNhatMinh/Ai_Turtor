/* global __APP_COMMIT_HASH__ */
// LogRocket facade. The SDK is loaded only when VITE_LOGROCKET_APP_ID is set at
// build time: importing `logrocket` directly makes the browser fetch its script
// from the LogRocket CDN, which must never happen in the offline/LAN build.
// Calls made before the SDK finishes loading are queued and replayed.
const APP_ID = import.meta.env.VITE_LOGROCKET_APP_ID;

let sdk = null;
let pending = [];

function call(method, args) {
  if (!APP_ID) return;
  if (sdk) sdk[method]?.(...args);
  else pending.push([method, args]);
}

export function initLogRocket() {
  if (!APP_ID) return;
  Promise.all([import('logrocket'), import('logrocket-react')])
    .then(([lrModule, reactModule]) => {
      const lr = lrModule.default || lrModule;
      lr.init(APP_ID, {
        release: typeof __APP_COMMIT_HASH__ === 'string' ? __APP_COMMIT_HASH__ : undefined,
      });
      const setupReact = typeof reactModule.default === 'function' ? reactModule.default : reactModule;
      if (typeof setupReact === 'function') setupReact(lr);
      sdk = lr;
      pending.forEach(([method, args]) => lr[method]?.(...args));
      pending = [];
    })
    .catch(() => {
      pending = [];
    });
}

const LogRocket = {
  identify: (...args) => call('identify', args),
  track: (...args) => call('track', args),
  captureException: (...args) => call('captureException', args),
};

export default LogRocket;
