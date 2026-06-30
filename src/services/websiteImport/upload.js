/**
 * Upload imported documentation as a real-text PDF to the backend.
 *
 * Uses the existing material upload endpoint:
 * POST /api/courses/{courseId}/materials/upload
 *
 * The backend only accepts PDF files, so we generate a PDF
 * from the extracted Markdown content using @react-pdf/renderer.
 */



const safeFileName = (title) =>
  `${String(title || 'website-documentation')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'website-documentation'}.pdf`;

/**
 * Generate a PDF from extracted pages and upload it to the backend.
 *
 * @param {{ apiService: object, courseId: string, title: string, sourceUrl: string, pages: Array<{title: string, url: string, markdown: string}>, currentUser: object }} params
 * @returns {Promise<any>}
 */
export async function uploadDocumentationMarkdown({
  apiService,
  courseId,
  title,
  sourceUrl,
  pages,
  currentUser,
}) {
  // Dynamically import to prevent @react-pdf/renderer from breaking Vite HMR / React context
  const { generateWebsitePdfBlob } = await import('./pdfGenerator.jsx');

  // Generate PDF blob from the extracted pages
  const pdfBlob = await generateWebsitePdfBlob({
    title: title || 'Imported Website Documentation',
    sourceUrl: sourceUrl || '',
    pages,
  });

  const fileName = safeFileName(title);
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title || 'Imported Website Documentation');
  formData.append('teacherId', currentUser?.userId || currentUser?.id || 'ADMIN');
  formData.append('uploaderRole', 'ADMIN');
  formData.append('type', 'website');
  formData.append('sourceUrl', sourceUrl || '');

  return apiService.uploadMaterial(courseId, formData);
}
