import { API_BASE_URL, blobRequest, uploadRequest } from './apiClient';
import { encodePath } from '../config/env';

export const normalizeKnowledgeImages = (source) => {
  const list = Array.isArray(source)
    ? source
    : source?.images || source?.imageAttachments || source?.knowledgeImages || source?.mentorAnswerImages || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === 'string') {
        return { fileId: item, fileName: '', contentType: '' };
      }
      return {
        fileId: item?.fileId || item?.id || '',
        fileName: item?.fileName || item?.filename || item?.name || '',
        contentType: item?.contentType || item?.mimeType || '',
        previewUrl: item?.previewUrl || '',
      };
    })
    .filter((item) => item.fileId);
};

export const knowledgeImagesApi = {
  async upload(file) {
    const formData = new FormData();
    formData.append('file', file);
    const data = await uploadRequest(
      `${API_BASE_URL}/tutor/knowledge-images`,
      formData,
      'Không thể tải hình minh họa',
    );
    return {
      fileId: data?.fileId || data?.id || '',
      fileName: data?.fileName || file?.name || 'minh-hoa.png',
      contentType: data?.contentType || file?.type || 'image/png',
    };
  },

  fetchBlob(fileId) {
    return blobRequest(`${API_BASE_URL}/tutor/knowledge-images/${encodePath(fileId)}`);
  },
};
