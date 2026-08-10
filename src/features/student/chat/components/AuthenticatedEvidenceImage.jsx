import { useEffect, useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import { blobRequest } from '../../../../services/apiClient';

function AuthenticatedEvidenceImage({ evidence }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  const openDocument = async () => {
    const [url] = String(evidence.documentUrl || '').split('#');
    if (!url) return;
    try {
      const pdf = await blobRequest(url);
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
    if (!evidence?.imageUrl) return undefined;
    blobRequest(evidence.imageUrl)
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
  }, [evidence?.imageUrl]);

  if (failed) {
    return <div className="visual-evidence-unavailable"><ImageOff size={18} /> Không tải được ảnh trang</div>;
  }

  return (
    <figure className="visual-evidence-card">
      {src ? <img src={src} alt={evidence.caption || `Trang ${evidence.pageNumber || ''} của tài liệu`} loading="lazy" /> : <div className="visual-evidence-loading">Đang tải ảnh minh họa…</div>}
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
