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
