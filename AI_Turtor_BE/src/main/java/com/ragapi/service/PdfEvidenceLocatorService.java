package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Resolves a verified evidence excerpt to its exact page in the original PDF. */
@Slf4j
@Service
@RequiredArgsConstructor
public class PdfEvidenceLocatorService {

    private static final int MAX_CACHED_PDFS = 8;
    private static final int MIN_SEARCH_CHARS = 40;

    private final PdfStorageService pdfStorageService;
    private final PdfExtractionService pdfExtractionService;
    private final Map<String, List<String>> pageCache = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, List<String>> eldest) {
            return size() > MAX_CACHED_PDFS;
        }
    };

    public PageLocation locate(CourseMaterial material, String verifiedExcerpt) {
        if (material == null
                || !"PDF".equalsIgnoreCase(material.getSourceType())
                || material.getPdfFileId() == null
                || material.getPdfFileId().isBlank()) {
            return null;
        }
        String needle = normalize(stripDisplayEllipsis(verifiedExcerpt));
        if (needle.length() < MIN_SEARCH_CHARS) return null;

        try {
            List<String> pages = pages(material.getPdfFileId());
            for (int index = 0; index < pages.size(); index++) {
                String current = normalize(pages.get(index));
                if (current.contains(needle)) return new PageLocation(index + 1, index + 1);
            }
            for (int index = 0; index + 1 < pages.size(); index++) {
                String acrossPages = normalize(pages.get(index)) + " " + normalize(pages.get(index + 1));
                if (acrossPages.contains(needle)) return new PageLocation(index + 1, index + 2);
            }
        } catch (Exception error) {
            log.warn("Could not locate exact evidence page for materialId={}: {}",
                    material.getId(), error.getMessage());
        }
        return null;
    }

    private List<String> pages(String pdfFileId) throws IOException {
        synchronized (pageCache) {
            List<String> cached = pageCache.get(pdfFileId);
            if (cached != null) return cached;
        }
        byte[] pdfBytes;
        try (var input = pdfStorageService.loadByFileId(pdfFileId).getInputStream()) {
            pdfBytes = input.readAllBytes();
        }
        List<String> extracted = List.copyOf(pdfExtractionService.extractPages(pdfBytes));
        synchronized (pageCache) {
            pageCache.put(pdfFileId, extracted);
        }
        return extracted;
    }

    private String stripDisplayEllipsis(String value) {
        if (value == null) return "";
        String clean = value.trim();
        if (clean.endsWith("...")) return clean.substring(0, clean.length() - 3).trim();
        if (clean.endsWith("…")) return clean.substring(0, clean.length() - 1).trim();
        return clean;
    }

    private String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
                .replace("\u00ad", "")
                .replaceAll("-\\s*\\n\\s*", "")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    public record PageLocation(int pageStart, int pageEnd) {
    }
}
