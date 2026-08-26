import { API_BASE_URL, API_TIMEOUTS, blobRequest, request, uploadRequest } from './apiClient';
import { encodePath } from '../config/env';
import { ApiError } from './httpClient';
import { getCachedResource, invalidateResourceCache } from './requestCache';

const materialCachePrefix = (courseId) => `materials:${courseId}:`;

export function assertMaterialUploadReceipt(response) {
  const materialId = String(response?.materialId || response?.documentId || '').trim();
  if (!materialId) {
    throw new ApiError({
      message: 'Backend không trả về mã học liệu.',
      userMessage: 'Máy chủ chưa xác nhận tệp đã tải lên. Hãy kiểm tra danh sách học liệu trước khi thử lại.',
      status: 502,
      code: 'INVALID_MATERIAL_UPLOAD_RESPONSE',
      details: response,
    });
  }
  return response;
}

export const materialsApi = {
  async uploadMaterial(courseId, formData) {
    const response = await uploadRequest(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/upload`, formData, 'Tải học liệu thất bại', {
      timeoutMs: API_TIMEOUTS.upload,
    });
    assertMaterialUploadReceipt(response);
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async importCourseMaterialUrl(courseId, payload) {
    const response = await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/import-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.websiteImport,
    });
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async previewMaterialUrlToc(courseId, payload) {
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/url-toc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.upload,
    });
  },

  async getCourseMaterials(courseId, classId = '', options = {}) {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    const qs = params.toString();
    const loader = () => request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials${qs ? `?${qs}` : ''}`, { signal: options.signal });
    if (options.signal) return loader();
    return getCachedResource(`${materialCachePrefix(courseId)}${classId || 'course'}`, loader, { force: options.force });
  },

  async updateMaterialMetadata(courseId, materialId, payload) {
    const response = await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async deleteMaterial(courseId, materialId) {
    const response = await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}`, {
      method: 'DELETE',
    });
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async reindexCourseMaterials(courseId) {
    const response = await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/reindex`, {
      method: 'POST',
      timeoutMs: API_TIMEOUTS.reindex,
    });
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async reindexMaterial(courseId, materialId) {
    const response = await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/reindex`, {
      method: 'POST',
      timeoutMs: API_TIMEOUTS.reindex,
    });
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async createMaterialDownloadTicket(courseId, materialId) {
    return request(
      `${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/download-ticket`,
      { method: 'POST', timeoutMs: API_TIMEOUTS.default },
    );
  },

  async downloadMaterialPdf(courseId, materialId) {
    return blobRequest(
      `${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/pdf`,
      { timeoutMs: API_TIMEOUTS.download, skipUnauthorizedRedirect: true },
    );
  },

  async getMaterialPageImage(courseId, materialId, pageNumber) {
    return blobRequest(
      `${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/pages/${encodePath(pageNumber)}/image`,
      { timeoutMs: API_TIMEOUTS.download, retries: 0, skipUnauthorizedRedirect: true },
    );
  },
};
