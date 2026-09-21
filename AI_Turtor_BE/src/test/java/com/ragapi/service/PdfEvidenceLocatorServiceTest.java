package com.ragapi.service;

import com.ragapi.entity.CourseMaterial;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.gridfs.GridFsResource;

import java.io.ByteArrayInputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PdfEvidenceLocatorServiceTest {

    @Mock PdfStorageService pdfStorageService;
    @Mock PdfExtractionService pdfExtractionService;
    @Mock GridFsResource resource;
    private PdfEvidenceLocatorService service;

    @BeforeEach
    void setUp() {
        service = new PdfEvidenceLocatorService(pdfStorageService, pdfExtractionService);
    }

    @Test
    void locatesExcerptOnExactPdfPage() throws Exception {
        CourseMaterial material = pdfMaterial();
        byte[] bytes = new byte[] {1, 2, 3};
        when(pdfStorageService.loadByFileId("pdf-file-1")).thenReturn(resource);
        when(resource.getInputStream()).thenReturn(new ByteArrayInputStream(bytes));
        when(pdfExtractionService.extractPages(bytes)).thenReturn(List.of(
                "Introduction to cache memory.",
                "Write-through updates main memory on every cache write.",
                "Cache replacement policies."
        ));

        var location = service.locate(material,
                "Write-through updates main memory on every cache write.");

        assertEquals(2, location.pageStart());
        assertEquals(2, location.pageEnd());
    }

    @Test
    void doesNotInventPageWhenExcerptIsAbsent() throws Exception {
        CourseMaterial material = pdfMaterial();
        byte[] bytes = new byte[] {4, 5, 6};
        when(pdfStorageService.loadByFileId("pdf-file-1")).thenReturn(resource);
        when(resource.getInputStream()).thenReturn(new ByteArrayInputStream(bytes));
        when(pdfExtractionService.extractPages(bytes)).thenReturn(List.of(
                "Introduction to cache memory with enough searchable text."
        ));

        assertNull(service.locate(material,
                "This unrelated evidence sentence does not occur anywhere in the original PDF."));
    }

    private CourseMaterial pdfMaterial() {
        CourseMaterial material = new CourseMaterial();
        material.setId("material-1");
        material.setSourceType("PDF");
        material.setPdfFileId("pdf-file-1");
        return material;
    }
}
