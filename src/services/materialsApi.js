import { API_BASE_URL, API_TIMEOUTS, blobRequest, request, uploadRequest } from './apiClient';
import { encodePath } from '../config/env';
import { ApiError } from './httpClient';
import { getCachedResource, invalidateResourceCache } from './requestCache';

const materialCachePrefix = (courseId) => `materials:${courseId}:`;

export function assertMaterialUploadReceipt(response) {
  const materialId = String(response?.materialId || response?.documentId || '').trim();
  if (!materialId) {
    throw new ApiError({
      message: 'The backend did not return a material identifier.',
      userMessage: 'The server did not confirm this upload. Please check the material list before trying again.',
      status: 502,
      code: 'INVALID_MATERIAL_UPLOAD_RESPONSE',
      details: response,
    });
  }
  return response;
}

export const materialsApi = {
  async uploadMaterial(courseId, formData) {
    const response = await uploadRequest(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/upload`, formData, 'Upload material failed', {
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
      timeoutMs: API_TIMEOUTS.upload,
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

  async deleteMaterial(courseId, materialId, teacherId = '') {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    const qs = params.toString();
    const response = await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async reindexCourseMaterials(courseId, teacherId = '') {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    const qs = params.toString();
    const response = await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/reindex${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async reindexMaterial(courseId, materialId, teacherId = '') {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    const qs = params.toString();
    const response = await request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/reindex${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
    invalidateResourceCache(materialCachePrefix(courseId));
    return response;
  },

  async downloadMaterialPdf(courseId, materialId) {
    return blobRequest(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/pdf`);
  },
};
