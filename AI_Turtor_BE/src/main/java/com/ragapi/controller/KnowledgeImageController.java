package com.ragapi.controller;

import com.ragapi.entity.KnowledgeImageAttachment;
import com.ragapi.service.KnowledgeImageStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/tutor/knowledge-images")
@RequiredArgsConstructor
@Tag(name = "Knowledge images", description = "Diagrams attached to teacher or senior academic answers")
public class KnowledgeImageController {

    private final KnowledgeImageStorageService knowledgeImageStorageService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a diagram or illustration for a knowledge answer")
    public ResponseEntity<?> upload(@RequestPart("file") MultipartFile file) {
        try {
            KnowledgeImageAttachment stored = knowledgeImageStorageService.store(file);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("id", stored.getFileId());
            body.put("fileId", stored.getFileId());
            body.put("fileName", stored.getFileName());
            body.put("contentType", stored.getContentType());
            return ResponseEntity.status(HttpStatus.CREATED).body(body);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            log.error("Cannot store knowledge image", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot store knowledge image"));
        }
    }

    @GetMapping("/{fileId}")
    @Operation(summary = "Load a knowledge illustration")
    public ResponseEntity<?> load(@PathVariable String fileId) {
        try {
            KnowledgeImageAttachment meta = knowledgeImageStorageService.describe(fileId);
            GridFsResource resource = knowledgeImageStorageService.loadByFileId(fileId);
            MediaType mediaType = safeMediaType(meta.getContentType());
            String fileName = meta.getFileName() == null || meta.getFileName().isBlank()
                    ? "minh-hoa.png"
                    : meta.getFileName();
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName.replace("\"", "") + "\"")
                    .body((Resource) resource);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    private MediaType safeMediaType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return MediaType.IMAGE_PNG;
        }
        try {
            return MediaType.parseMediaType(contentType);
        } catch (Exception e) {
            return MediaType.IMAGE_PNG;
        }
    }
}
