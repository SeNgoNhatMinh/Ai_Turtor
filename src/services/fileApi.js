import { apiService } from './api';

export const fileApi = {
  uploadMaterial: apiService.uploadMaterial,
  getMaterial: apiService.getMaterial,
  updateMaterialMetadata: apiService.updateMaterialMetadata,
  deleteMaterial: apiService.deleteMaterial,
  reindexMaterial: apiService.reindexMaterial,
  downloadMaterialPdf: apiService.downloadMaterialPdf,
  downloadAssignmentFile: apiService.downloadAssignmentFile,
  downloadSubmissionFile: apiService.downloadSubmissionFile,
  uploadCodeFileAI: apiService.uploadCodeFileAI,
  uploadCodeFileMentor: apiService.uploadCodeFileMentor,
};
