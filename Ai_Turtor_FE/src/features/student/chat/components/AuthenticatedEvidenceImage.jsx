import { useEffect, useRef, useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import { API_TIMEOUTS, blobRequest } from '../../../../services/apiClient';

function AuthenticatedEvidenceImage({ evidence, enabled = true }) {
  const containerRef = useRef(null);
  const [manualLoadRequested, setManualLoadRequested] = useState(false);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  const loadRequested = enabled || manualLoadRequested;
  const supportsIntersectionObserver = typeof IntersectionObserver !== 'undefined';
  const shouldLoad = loadRequested && (!supportsIntersectionObserver || isNearViewport);

  useEffect(() => {
    if (!loadRequested || !evidence?.imageUrl || !supportsIntersectionObserver) return undefined;

    const node = containerRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadRequested, evidence?.imageUrl, supportsIntersectionObserver]);

  const openDocument = async () => {
    const [url] = String(evidence.documentUrl || '').split('#');
    if (!url) return;
    try {
      const pdf = await blobRequest(url, { skipUnauthorizedRedirect: true, timeoutMs: API_TIMEOUTS.upload });
      const objectUrl = URL.createObjectURL(pdf);
      window.open(`${objectUrl}#page=${evidence.pageNumber || 1}`, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    let objectUrl = '';
    let active = true;
    if (!shouldLoad || !evidence?.imageUrl) return undefined;

    blobRequest(evidence.imageUrl, { skipUnauthorizedRedirect: true, timeoutMs: API_TIMEOUTS.upload })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => active && setFailed(true));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shouldLoad, evidence?.imageUrl]);

  if (failed) {
    return (
      <div className="visual-evidence-unavailable" ref={containerRef}>
        <ImageOff size={18} /> Không tải được ảnh trang
      </div>
    );
  }

  return (
    <figure className="visual-evidence-card" ref={containerRef}>
      {src ? (
        <img src={src} alt={evidence.caption || `Trang ${evidence.pageNumber || ''} của tài liệu`} loading="lazy" />
      ) : !loadRequested ? (
        <div className="visual-evidence-loading">
          <button type="button" onClick={() => setManualLoadRequested(true)}>
            Tải ảnh trang {evidence.pageNumber || ''}
          </button>
        </div>
      ) : (
        <div className="visual-evidence-loading">
          {shouldLoad ? 'Đang tải ảnh minh họa…' : 'Cuộn tới để xem ảnh trang'}
        </div>
      )}
      <figcaption>
        <div>
          <span>{evidence.caption || `Hình ảnh từ trang ${evidence.pageNumber}`}</span>
          <small className="visual-evidence-meta">
            {evidence.pageNumber != null && `Trang ${evidence.pageNumber}`}
            {evidence.retrievalProvider && ` · ${evidence.retrievalProvider}`}
            {evidence.pageEstimated ? ' · Số trang ước tính' : ' · Số trang xác định'}
          </small>
        </div>
        {evidence.documentUrl && <button type="button" onClick={openDocument}>Xem trang gốc <ExternalLink size={13} /></button>}
      </figcaption>
    </figure>
  );
}

export default AuthenticatedEvidenceImage;
