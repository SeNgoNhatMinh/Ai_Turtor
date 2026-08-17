package com.ragapi.service;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PdfPageRenderService {

    private static final float PREVIEW_DPI = 96f;
    private static final int MAX_PAGE_CACHE_ENTRIES = 256;
    private static final int MAX_DOCUMENT_CACHE_ENTRIES = 8;

    private final PdfStorageService pdfStorageService;
    @Value("${rag.preview.cache-dir:/app/data/pdf-preview-cache}")
    private String persistentCacheDirectory;
    private final Map<String, byte[]> pageCache = new ConcurrentHashMap<>();
    private final Map<String, CachedDocument> documentCache = new ConcurrentHashMap<>();
    private final Map<String, Object> pageLoadLocks = new ConcurrentHashMap<>();
    private final Map<String, Object> documentLoadLocks = new ConcurrentHashMap<>();
    private final ExecutorService previewWarmupExecutor = Executors.newFixedThreadPool(2, runnable -> {
        Thread thread = new Thread(runnable, "pdf-preview-warmup");
        thread.setDaemon(true);
        return thread;
    });

    public byte[] renderPage(String materialId, int pageNumber) throws IOException {
        if (pageNumber < 1) {
            throw new IllegalArgumentException("pageNumber must be greater than zero");
        }

        String cacheKey = materialId + ":" + pageNumber;
        byte[] cachedPage = pageCache.get(cacheKey);
        if (cachedPage != null) {
            return cachedPage;
        }

        Path pageCachePath = pageCachePath(materialId, pageNumber);
        cachedPage = readPersistentCache(pageCachePath);
        if (cachedPage != null) {
            rememberPage(cacheKey, cachedPage);
            return cachedPage;
        }

        Object pageLock = pageLoadLocks.computeIfAbsent(cacheKey, ignored -> new Object());
        synchronized (pageLock) {
            try {
                cachedPage = pageCache.get(cacheKey);
                if (cachedPage != null) {
                    return cachedPage;
                }
                cachedPage = readPersistentCache(pageCachePath);
                if (cachedPage != null) {
                    rememberPage(cacheKey, cachedPage);
                    return cachedPage;
                }

                long startedAt = System.currentTimeMillis();
                CachedDocument cachedDocument = loadDocument(materialId);
                try (PDDocument document = Loader.loadPDF(cachedDocument.pdfBytes())) {
                    if (pageNumber > document.getNumberOfPages()) {
                        throw new IllegalArgumentException("PDF page does not exist");
                    }
                    var image = new PDFRenderer(document).renderImageWithDPI(pageNumber - 1, PREVIEW_DPI, ImageType.RGB);
                    try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                        ImageIO.write(image, "png", output);
                        byte[] rendered = output.toByteArray();
                        rememberPage(cacheKey, rendered);
                        writePersistentCache(pageCachePath, rendered);
                        log.info(
                                "Rendered PDF preview materialId={}, page={}, size={} bytes, elapsedMs={}",
                                materialId,
                                pageNumber,
                                rendered.length,
                                System.currentTimeMillis() - startedAt
                        );
                        return rendered;
                    }
                }
            } finally {
                pageLoadLocks.remove(cacheKey, pageLock);
            }
        }
    }

    private CachedDocument loadDocument(String materialId) throws IOException {
        CachedDocument cached = documentCache.get(materialId);
        if (cached != null) {
            CachedDocument touched = cached.touch();
            documentCache.put(materialId, touched);
            return touched;
        }

        Object documentLock = documentLoadLocks.computeIfAbsent(materialId, ignored -> new Object());
        synchronized (documentLock) {
            try {
                cached = documentCache.get(materialId);
                if (cached != null) {
                    CachedDocument touched = cached.touch();
                    documentCache.put(materialId, touched);
                    return touched;
                }

                long startedAt = System.currentTimeMillis();
                Path pdfCachePath = pdfCachePath(materialId);
                byte[] pdfBytes = readPersistentCache(pdfCachePath);
                if (pdfBytes == null) {
                    var resource = pdfStorageService.loadByDocumentId(materialId);
                    try (var input = resource.getInputStream()) {
                        pdfBytes = input.readAllBytes();
                    }
                    writePersistentCache(pdfCachePath, pdfBytes);
                }
                CachedDocument loaded = new CachedDocument(pdfBytes);
                if (documentCache.size() >= MAX_DOCUMENT_CACHE_ENTRIES) {
                    documentCache.entrySet().stream()
                            .min(Map.Entry.comparingByValue(
                                    (left, right) -> Long.compare(left.lastUsedAt(), right.lastUsedAt())
                            ))
                            .ifPresent(entry -> documentCache.remove(entry.getKey()));
                }
                documentCache.put(materialId, loaded);
                log.info(
                        "Loaded PDF into preview cache materialId={}, size={} bytes, elapsedMs={}",
                        materialId,
                        pdfBytes.length,
                        System.currentTimeMillis() - startedAt
                );
                return loaded;
            } finally {
                documentLoadLocks.remove(materialId, documentLock);
            }
        }
    }

    private void rememberPage(String cacheKey, byte[] rendered) {
        if (pageCache.size() >= MAX_PAGE_CACHE_ENTRIES) {
            pageCache.clear();
        }
        pageCache.put(cacheKey, rendered);
    }

    public boolean isCachedMaterialCourse(String courseId, String materialId) {
        if (courseId == null || materialId == null || !Files.isRegularFile(pdfCachePath(materialId))) {
            return false;
        }
        Path marker = courseMarkerPath(materialId);
        try {
            return Files.isRegularFile(marker)
                    && courseId.trim().equals(Files.readString(marker, StandardCharsets.UTF_8).trim());
        } catch (IOException error) {
            log.warn("Cannot read PDF preview course marker path={}: {}", marker, error.getMessage());
            return false;
        }
    }

    public void rememberMaterialCourse(String courseId, String materialId) {
        if (courseId == null || courseId.isBlank() || materialId == null || materialId.isBlank()) {
            return;
        }
        writePersistentCache(
                courseMarkerPath(materialId),
                courseId.trim().getBytes(StandardCharsets.UTF_8)
        );
    }

    public void cacheDocument(String courseId, String materialId, byte[] pdfBytes) {
        if (materialId == null || materialId.isBlank() || pdfBytes == null || pdfBytes.length == 0) {
            return;
        }
        documentCache.put(materialId, new CachedDocument(pdfBytes));
        writePersistentCache(pdfCachePath(materialId), pdfBytes);
        rememberMaterialCourse(courseId, materialId);
    }

    public byte[] loadDocumentBytes(String materialId) throws IOException {
        return loadDocument(materialId).pdfBytes();
    }

    public void preloadPageAsync(String materialId, Integer pageNumber) {
        if (materialId == null || materialId.isBlank() || pageNumber == null || pageNumber < 1) {
            return;
        }
        if (pageCache.containsKey(materialId + ":" + pageNumber)
                || Files.isRegularFile(pageCachePath(materialId, pageNumber))) {
            return;
        }
        previewWarmupExecutor.submit(() -> {
            try {
                renderPage(materialId, pageNumber);
            } catch (Exception error) {
                log.warn("Cannot preload PDF preview materialId={}, page={}: {}",
                        materialId, pageNumber, error.getMessage());
            }
        });
    }

    @PreDestroy
    void shutdownPreviewWarmupExecutor() {
        previewWarmupExecutor.shutdownNow();
    }

    public void evictMaterial(String materialId) {
        if (materialId == null || materialId.isBlank()) {
            return;
        }
        documentCache.remove(materialId);
        String pagePrefix = materialId + ":";
        pageCache.keySet().removeIf(key -> key.startsWith(pagePrefix));

        String filePrefix = safeFilePart(materialId);
        Path root = cacheRoot();
        if (!Files.isDirectory(root)) {
            return;
        }
        try (var paths = Files.list(root)) {
            paths.filter(path -> path.getFileName().toString().startsWith(filePrefix))
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException error) {
                            log.warn("Cannot delete PDF preview cache path={}: {}", path, error.getMessage());
                        }
                    });
        } catch (IOException error) {
            log.warn("Cannot scan PDF preview cache directory={}: {}", root, error.getMessage());
        }
    }

    private Path pdfCachePath(String materialId) {
        return cacheRoot().resolve(safeFilePart(materialId) + ".pdf");
    }

    private Path courseMarkerPath(String materialId) {
        return cacheRoot().resolve(safeFilePart(materialId) + ".course");
    }

    private Path pageCachePath(String materialId, int pageNumber) {
        return cacheRoot().resolve(safeFilePart(materialId) + "-page-" + pageNumber + ".png");
    }

    private Path cacheRoot() {
        return Path.of(persistentCacheDirectory).toAbsolutePath().normalize();
    }

    private String safeFilePart(String value) {
        return String.valueOf(value).replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private byte[] readPersistentCache(Path path) {
        try {
            return Files.isRegularFile(path) ? Files.readAllBytes(path) : null;
        } catch (IOException error) {
            log.warn("Cannot read PDF preview cache path={}: {}", path, error.getMessage());
            return null;
        }
    }

    private void writePersistentCache(Path path, byte[] bytes) {
        try {
            Files.createDirectories(path.getParent());
            Path temporary = Files.createTempFile(path.getParent(), path.getFileName().toString(), ".tmp");
            try {
                Files.write(temporary, bytes);
                Files.move(temporary, path, StandardCopyOption.REPLACE_EXISTING);
            } finally {
                Files.deleteIfExists(temporary);
            }
        } catch (IOException error) {
            log.warn("Cannot write PDF preview cache path={}: {}", path, error.getMessage());
        }
    }

    private record CachedDocument(byte[] pdfBytes, long lastUsedAt) {
        CachedDocument(byte[] pdfBytes) {
            this(pdfBytes, System.currentTimeMillis());
        }

        CachedDocument touch() {
            return new CachedDocument(pdfBytes, System.currentTimeMillis());
        }
    }

    public int countPages(String materialId) throws IOException {
        CachedDocument cachedDocument = loadDocument(materialId);
        try (PDDocument document = Loader.loadPDF(cachedDocument.pdfBytes())) {
            return document.getNumberOfPages();
        }
    }
}
