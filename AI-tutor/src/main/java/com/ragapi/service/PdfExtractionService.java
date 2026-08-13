package com.ragapi.service;

import com.ragapi.dto.PdfExtractionResult;
import com.ragapi.entity.MaterialTocEntry;
import com.ragapi.util.ChapterHeadingUtils;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.interactive.action.PDActionGoTo;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.destination.PDDestination;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageDestination;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class PdfExtractionService {

    static final int MAX_TOC_ENTRIES = 80;
    static final int MAX_TOC_LEVEL = 2;

    @Value("${upload.pdf.max-size-mb:50}")
    private int maxSizeMb;

    @Value("${upload.pdf.min-text-length:50}")
    private int minTextLength;

    public String extractText(MultipartFile file) throws IOException {
        validatePdf(file);
        return extract(file.getBytes(), file.getOriginalFilename()).text();
    }

    public String extractText(byte[] pdfBytes, String fileName) throws IOException {
        return extract(pdfBytes, fileName).text();
    }

    public PdfExtractionResult extract(MultipartFile file) throws IOException {
        validatePdf(file);
        return extract(file.getBytes(), file.getOriginalFilename());
    }

    public PdfExtractionResult extract(byte[] pdfBytes, String fileName) throws IOException {
        log.info("Extracting text from PDF: {}", fileName);

        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            stripper.setLineSeparator("\n");

            String rawText = stripper.getText(document);
            String normalized = normalizeVietnameseText(rawText);

            if (normalized.length() < minTextLength) {
                throw new IllegalArgumentException(
                        "Could not extract enough text from PDF. "
                                + "The file may be scanned; OCR or a text-based PDF is required."
                );
            }

            int pageCount = document.getNumberOfPages();
            List<MaterialTocEntry> tableOfContents = extractTableOfContents(document);

            log.info(
                    "Extracted {} characters, {} pages, {} bookmark entries from {}",
                    normalized.length(),
                    pageCount,
                    tableOfContents.size(),
                    fileName
            );

            return new PdfExtractionResult(normalized, pageCount, tableOfContents);
        }
    }

    public String extractPageRange(byte[] pdfBytes, int startPage, int endPage) throws IOException {
        if (pdfBytes == null || pdfBytes.length == 0) {
            return "";
        }
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            int totalPages = document.getNumberOfPages();
            if (totalPages <= 0) {
                return "";
            }
            int safeStart = Math.max(1, Math.min(startPage, totalPages));
            int safeEnd = Math.max(safeStart, Math.min(endPage, totalPages));

            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            stripper.setLineSeparator("\n");
            stripper.setStartPage(safeStart);
            stripper.setEndPage(safeEnd);

            return normalizeVietnameseText(stripper.getText(document));
        }
    }

    public List<MaterialTocEntry> extractTableOfContents(byte[] pdfBytes) throws IOException {
        if (pdfBytes == null || pdfBytes.length == 0) {
            return List.of();
        }
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            return extractTableOfContents(document);
        }
    }

    private List<MaterialTocEntry> extractTableOfContents(PDDocument document) throws IOException {
        PDDocumentOutline outline = document.getDocumentCatalog().getDocumentOutline();
        if (outline == null) {
            return List.of();
        }

        List<MaterialTocEntry> entries = new ArrayList<>();
        walkOutline(document, outline.getFirstChild(), 0, entries);
        assignPageEndEntries(entries, document.getNumberOfPages());
        return entries;
    }

    private void walkOutline(PDDocument document, PDOutlineItem item, int level, List<MaterialTocEntry> entries)
            throws IOException {
        while (item != null) {
            if (entries.size() >= MAX_TOC_ENTRIES) {
                return;
            }

            String title = item.getTitle();
            if (title != null) {
                title = title.trim();
            }

            if (level <= MAX_TOC_LEVEL
                    && title != null
                    && !title.isBlank()
                    && ChapterHeadingUtils.isPlausibleChapterTitle(title)) {
                entries.add(MaterialTocEntry.builder()
                        .title(title)
                        .level(level)
                        .pageStart(resolvePageNumber(document, item))
                        .build());
            }

            if (item.hasChildren() && level < MAX_TOC_LEVEL) {
                walkOutline(document, item.getFirstChild(), level + 1, entries);
            }

            item = item.getNextSibling();
        }
    }

    static void assignPageEndEntries(List<MaterialTocEntry> entries, int totalPages) {
        for (int i = 0; i < entries.size(); i++) {
            MaterialTocEntry entry = entries.get(i);
            int pageEnd = totalPages;
            for (int j = i + 1; j < entries.size(); j++) {
                MaterialTocEntry next = entries.get(j);
                if (next.getLevel() <= entry.getLevel() && next.getPageStart() > 0) {
                    pageEnd = Math.max(entry.getPageStart(), next.getPageStart() - 1);
                    break;
                }
            }
            if (entry.getPageStart() > 0) {
                pageEnd = Math.max(pageEnd, entry.getPageStart());
            }
            entry.setPageEnd(pageEnd);
        }
    }

    private int resolvePageNumber(PDDocument document, PDOutlineItem item) throws IOException {
        PDDestination destination = item.getDestination();
        if (destination == null && item.getAction() instanceof PDActionGoTo action) {
            destination = action.getDestination();
        }
        if (!(destination instanceof PDPageDestination pageDestination)) {
            return 0;
        }
        PDPage page = pageDestination.getPage();
        if (page != null) {
            int index = document.getPages().indexOf(page);
            if (index >= 0) {
                return index + 1;
            }
        }
        var destinationPage = pageDestination.getCOSObject();
        var pages = document.getPages();
        for (int i = 0; i < pages.getCount(); i++) {
            if (pages.get(i).getCOSObject().equals(destinationPage)) {
                return i + 1;
            }
        }
        return 0;
    }

    private void validatePdf(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("PDF file must not be empty");
        }

        long maxBytes = (long) maxSizeMb * 1024 * 1024;
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "File exceeds max allowed size: " + maxSizeMb + " MB"
            );
        }

        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase().endsWith(".pdf")) {
            throw new IllegalArgumentException("Only .pdf files are accepted");
        }

        String contentType = file.getContentType();
        if (contentType != null
                && !contentType.equals("application/pdf")
                && !contentType.equals("application/x-pdf")) {
            throw new IllegalArgumentException("File content type must be PDF");
        }
    }

    private String normalizeVietnameseText(String text) {
        if (text == null) {
            return "";
        }

        String normalized = Normalizer.normalize(text, Normalizer.Form.NFC);
        normalized = normalized.replace("\r\n", "\n").replace('\r', '\n');
        normalized = normalized.replaceAll("[ \t]+", " ");
        normalized = normalized.replaceAll("\n{3,}", "\n\n");

        return normalized.trim();
    }
}
