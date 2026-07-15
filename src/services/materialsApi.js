import { API_BASE_URL, API_TIMEOUTS, blobRequest, request, uploadRequest } from './apiClient';
import { encodePath } from '../config/env';

export const materialsApi = {
  async uploadMaterial(courseId, formData) {
    return uploadRequest(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/upload`, formData, 'Upload material failed', {
      timeoutMs: API_TIMEOUTS.upload,
    });
  },

  async importCourseMaterialUrl(courseId, payload) {
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/import-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.upload,
    });
  },

  async previewMaterialUrlToc(courseId, payload) {
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/url-toc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: API_TIMEOUTS.upload,
    });
  },

  async getCourseMaterials(courseId, classId = '') {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    const qs = params.toString();
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials${qs ? `?${qs}` : ''}`);
  },

  async updateMaterialMetadata(courseId, materialId, payload) {
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async deleteMaterial(courseId, materialId, teacherId = '') {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    const qs = params.toString();
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
    });
  },

  async reindexCourseMaterials(courseId, teacherId = '') {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    const qs = params.toString();
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/reindex${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  },

  async reindexMaterial(courseId, materialId, teacherId = '') {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId);
    const qs = params.toString();
    return request(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/reindex${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  },

  async downloadMaterialPdf(courseId, materialId) {
    return blobRequest(`${API_BASE_URL}/courses/${encodePath(courseId)}/materials/${encodePath(materialId)}/pdf`);
  },
};
