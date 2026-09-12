import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys.js';
import { knowledgeImagesApi } from '../../../services/knowledgeImagesApi.js';
import { normalizeKnowledgeImages } from '../../../services/knowledgeImageNormalizers.js';

function KnowledgeImageThumb({ image }) {
  const [blobSrc, setBlobSrc] = useState('');
  const src = image.previewUrl || blobSrc;
  const imageQuery = useQuery({
    queryKey: queryKeys.knowledgeImage(image.fileId),
    queryFn: ({ signal }) => knowledgeImagesApi.fetchBlob(image.fileId, { signal }),
    enabled: !image.previewUrl && Boolean(image.fileId),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!imageQuery.data || image.previewUrl) return undefined;
    const objectUrl = URL.createObjectURL(imageQuery.data);
    let active = true;
    queueMicrotask(() => {
      if (active) setBlobSrc(objectUrl);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [image.previewUrl, imageQuery.data]);

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
