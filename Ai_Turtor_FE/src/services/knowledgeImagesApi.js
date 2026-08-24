import { API_BASE_URL, blobRequest, uploadRequest } from './apiClient';
import { encodePath } from '../config/env';

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
