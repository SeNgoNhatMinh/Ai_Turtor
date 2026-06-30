import React, { memo, useState } from 'react';
import { X } from 'lucide-react';
import { sanitizeImageUrl } from '../../utils/markdownSecurity';

function MarkdownImage({ src, alt = '', title }) {
  const [zoomed, setZoomed] = useState(false);
  const safeSrc = sanitizeImageUrl(src);

  if (!safeSrc) {
    return <span className="ai-answer-image-error">Image blocked for security.</span>;
  }

  return (
    <>
      <button
        type="button"
        className="ai-answer-image-button"
        onClick={() => setZoomed(true)}
        aria-label={alt ? `Zoom image: ${alt}` : 'Zoom image'}
      >
        <img className="ai-answer-image" src={safeSrc} alt={alt} title={title} loading="lazy" />
      </button>

      {zoomed && (
        <div
          className="ai-answer-image-modal"
          role="dialog"
          aria-modal="true"
          aria-label={alt || 'Image preview'}
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            className="ai-answer-image-modal-close"
            onClick={(event) => {
              event.stopPropagation();
              setZoomed(false);
            }}
            aria-label="Close image preview"
          >
            <X size={18} aria-hidden="true" />
          </button>
          <img src={safeSrc} alt={alt} />
        </div>
      )}
    </>
  );
}

export default memo(MarkdownImage);
