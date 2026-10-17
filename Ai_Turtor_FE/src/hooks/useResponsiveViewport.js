import { useEffect, useState } from 'react';

// A phone that asks for the desktop site can report a layout wider than 767px
// while still using a coarse pointer. Cap that exception so a wide touchscreen
// laptop keeps the website layout.
const MOBILE_QUERY = '(max-width: 767px), (max-width: 1023px) and (hover: none) and (pointer: coarse)';

export function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

function readViewport() {
  if (typeof window === 'undefined') {
    return { isMobile: false, width: 1024, height: 768, offsetTop: 0, offsetLeft: 0 };
  }

  const viewport = window.visualViewport;
  return {
    isMobile: isMobileViewport(),
    width: Math.round(viewport?.width || window.innerWidth),
    height: Math.round(viewport?.height || window.innerHeight),
    offsetTop: Math.round(viewport?.offsetTop || 0),
    offsetLeft: Math.round(viewport?.offsetLeft || 0),
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
        document.documentElement.style.setProperty('--app-viewport-offset-top', `${nextViewport.offsetTop}px`);
        document.documentElement.style.setProperty('--app-viewport-offset-left', `${nextViewport.offsetLeft}px`);
        setViewport((current) => (
          current.isMobile === nextViewport.isMobile
          && current.width === nextViewport.width
          && current.height === nextViewport.height
          && current.offsetTop === nextViewport.offsetTop
          && current.offsetLeft === nextViewport.offsetLeft
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
    visualViewport?.addEventListener('scroll', update, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  return viewport;
}
