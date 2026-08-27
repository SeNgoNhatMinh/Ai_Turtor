import { useEffect, useState } from 'react';
import { knowledgeImagesApi } from '../../../services/knowledgeImagesApi.js';
import { normalizeKnowledgeImages } from '../../../services/knowledgeImageNormalizers.js';

function KnowledgeImageThumb({ image }) {
  const [blobSrc, setBlobSrc] = useState('');
  const src = image.previewUrl || blobSrc;

  useEffect(() => {
    if (image.previewUrl) return undefined;
    if (!image.fileId) return undefined;
    let objectUrl = '';
    let cancelled = false;
    knowledgeImagesApi.fetchBlob(image.fileId).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setBlobSrc(objectUrl);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.fileId, image.previewUrl]);

  if (!src) {
    return (
      <div className="knowledge-image-thumb knowledge-image-thumb--empty" title={image.fileName}>
        {image.fileName || 'Hình minh họa'}
      </div>
    );
  }

  return (
    <a
      className="knowledge-image-thumb"
      href={src}
      target="_blank"
      rel="noreferrer"
      title={image.fileName || 'Mở hình minh họa'}
    >
      <img
        src={src}
        alt={image.fileName || 'Hình minh họa'}
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}

export default function KnowledgeImageGallery({ images, emptyLabel = '' }) {
  const items = normalizeKnowledgeImages(images);
  if (!items.length) {
    return emptyLabel ? <p className="knowledge-image-gallery__empty">{emptyLabel}</p> : null;
  }

  return (
    <div className="knowledge-image-gallery" aria-label="Hình minh họa">
      {items.map((image) => (
        <KnowledgeImageThumb key={image.fileId} image={image} />
      ))}
    </div>
  );
}
