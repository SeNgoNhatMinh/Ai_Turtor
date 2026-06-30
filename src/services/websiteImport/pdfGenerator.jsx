import { jsPDF } from 'jspdf';

/**
 * Generate a PDF blob from website documentation using jsPDF.
 * This completely avoids @react-pdf/renderer Yoga flexbox layout crashes (-8.559e21)
 * because it manually draws text line-by-line without relying on a layout engine.
 *
 * For RAG purposes, we inject the RAW markdown text directly into the PDF.
 * This ensures no formatting (like tables or code) is lost during rendering,
 * and Tika will extract the markdown perfectly for the LLM.
 */
export const generateWebsitePdfBlob = async ({ title, sourceUrl, pages }) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const maxLineWidth = pageWidth - margin * 2;
      let cursorY = margin;

      const addNewPage = () => {
        doc.addPage();
        cursorY = margin;
      };

      const addText = (text, fontSize = 10, isBold = false) => {
        if (!text) return;
        
        doc.setFont('Helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        
        // Split text to fit max width safely
        // jsPDF handles long strings without crashing (it just truncates or wraps them)
        const lines = doc.splitTextToSize(String(text), maxLineWidth);
        
        for (let i = 0; i < lines.length; i++) {
          if (cursorY + fontSize > pageHeight - margin) {
            addNewPage();
          }
          // Prevent drawing empty strings
          if (lines[i].trim().length > 0) {
            doc.text(lines[i], margin, cursorY);
          }
          cursorY += (fontSize * 1.35); // Line height
        }
        cursorY += 8; // Paragraph spacing
      };

      // 1. Title Page
      addText(title || 'Imported Documentation', 20, true);
      addText(`Source URL: ${sourceUrl || 'Unknown'}`, 10, false);
      addNewPage();

      // 2. Table of Contents
      addText('Table of Contents', 16, true);
      pages.forEach((page, index) => {
        addText(`${index + 1}. ${page.title || 'Untitled Page'}`, 10, false);
      });
      addNewPage();

      // 3. Chapters (Raw Markdown Injection for optimal RAG extraction)
      pages.forEach((page, index) => {
        if (index > 0) addNewPage();
        
        // Chapter Header
        addText(`${index + 1}. ${page.title || 'Untitled Page'}`, 16, true);
        addText(`Source: ${page.url || 'Unknown'}`, 8, false);
        
        // Add a separator
        addText('------------------------------------------------------------', 10, false);
        
        // Inject Markdown text directly.
        // Tika indexer will extract this verbatim!
        const markdownLines = (page.markdown || '').split('\n');
        
        markdownLines.forEach(line => {
           addText(line, 10, false);
        });
      });

      const blob = doc.output('blob');
      resolve(blob);
    } catch (error) {
      console.error('jsPDF generation failed:', error);
      reject(error);
    }
  });
};