import { useEffect, useState } from 'react';

// Mobile Safari can expose a desktop-like layout viewport when the page was
// previously zoomed or opened in "Request Desktop Website" mode. Pointer
// capability keeps the app shell on the mobile navigation in that case.
const MOBILE_QUERY = '(max-width: 767px), (hover: none) and (pointer: coarse)';

export function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

function readViewport() {
  if (typeof window === 'undefined') {
    return { isMobile: false, width: 1024, height: 768 };
  }

  const viewport = window.visualViewport;
  return {
    isMobile: isMobileViewport(),
    width: Math.round(viewport?.width || window.innerWidth),
    height: Math.round(viewport?.height || window.innerHeight),
  };
}

export default function useResponsiveViewport() {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const visualViewport = window.visualViewport;
    let frame = 0;

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextViewport = readViewport();
        document.documentElement.style.setProperty('--app-viewport-height', `${nextViewport.height}px`);
        setViewport((current) => (
          current.isMobile === nextViewport.isMobile
          && current.width === nextViewport.width
          && current.height === nextViewport.height
            ? current
            : nextViewport
        ));
      });
    };

    update();
    mediaQuery.addEventListener('change', update);
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    visualViewport?.addEventListener('resize', update, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return viewport;
}
