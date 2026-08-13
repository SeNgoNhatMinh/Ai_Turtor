package com.ragapi.service;

import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

@Service
@RequiredArgsConstructor
public class PdfPageRenderService {

    private static final float PREVIEW_DPI = 144f;
    private final PdfStorageService pdfStorageService;

    public byte[] renderPage(String materialId, int pageNumber) throws IOException {
        if (pageNumber < 1) {
            throw new IllegalArgumentException("pageNumber must be greater than zero");
        }
        var resource = pdfStorageService.loadByDocumentId(materialId);
        try (var input = resource.getInputStream(); PDDocument document = Loader.loadPDF(input.readAllBytes())) {
            if (pageNumber > document.getNumberOfPages()) {
                throw new IllegalArgumentException("PDF page does not exist");
            }
            var image = new PDFRenderer(document).renderImageWithDPI(pageNumber - 1, PREVIEW_DPI, ImageType.RGB);
            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                ImageIO.write(image, "png", output);
                return output.toByteArray();
            }
        }
    }

    public int countPages(String materialId) throws IOException {
        var resource = pdfStorageService.loadByDocumentId(materialId);
        try (var input = resource.getInputStream(); PDDocument document = Loader.loadPDF(input.readAllBytes())) {
            return document.getNumberOfPages();
        }
    }
}
