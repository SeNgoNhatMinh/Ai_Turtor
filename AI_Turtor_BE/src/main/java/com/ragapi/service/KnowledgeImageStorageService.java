package com.ragapi.service;

import com.mongodb.client.gridfs.model.GridFSFile;
import com.ragapi.entity.KnowledgeImageAttachment;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import static com.ragapi.util.ValidationUtils.KNOWLEDGE_IMAGE_MAX_COUNT;
import static com.ragapi.util.ValidationUtils.KNOWLEDGE_IMAGE_MAX_SIZE_MB;
import static com.ragapi.util.ValidationUtils.getExtension;

@Service
@RequiredArgsConstructor
public class KnowledgeImageStorageService {

    public static final String FILE_TYPE = "KNOWLEDGE_IMAGE";

    private static final Set<String> IMAGE_EXTENSIONS = Set.of("png", "jpg", "jpeg", "webp", "gif");
    private static final Set<String> IMAGE_CONTENT_TYPES = Set.of(
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
            "image/gif"
    );

    private final GridFsTemplate gridFsTemplate;

    public KnowledgeImageAttachment store(MultipartFile file) throws IOException {
        validateImage(file);

        String originalName = file.getOriginalFilename();
        String contentType = normalizeContentType(file.getContentType(), originalName);
        String fileName = originalName == null || originalName.isBlank() || !originalName.contains(".")
                ? "minh-hoa." + extensionForContentType(contentType)
                : originalName.trim();

        org.bson.Document metadata = new org.bson.Document()
                .append("fileType", FILE_TYPE)
                .append("contentType", contentType);

        ObjectId fileId = gridFsTemplate.store(
                file.getInputStream(),
                fileName,
                contentType,
                metadata
        );

        return KnowledgeImageAttachment.builder()
                .fileId(fileId.toHexString())
                .fileName(fileName)
                .contentType(contentType)
                .build();
    }

    public GridFsResource loadByFileId(String fileId) {
        GridFSFile file = findKnowledgeImage(fileId);
        return gridFsTemplate.getResource(file);
    }

    public KnowledgeImageAttachment describe(String fileId) {
        GridFSFile file = findKnowledgeImage(fileId);
        String contentType = file.getMetadata() != null ? file.getMetadata().getString("contentType") : null;
        if (contentType == null || contentType.isBlank()) {
            contentType = file.getMetadata() != null ? file.getMetadata().getString("_contentType") : "image/png";
        }
        return KnowledgeImageAttachment.builder()
                .fileId(fileId)
                .fileName(file.getFilename() == null || file.getFilename().isBlank() ? "minh-hoa.png" : file.getFilename())
                .contentType(contentType == null || contentType.isBlank() ? "image/png" : contentType)
                .build();
    }

    public List<KnowledgeImageAttachment> resolveAttachments(List<String> imageIds) {
        if (imageIds == null || imageIds.isEmpty()) {
            return List.of();
        }
        List<String> uniqueIds = new ArrayList<>(new LinkedHashSet<>(imageIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .toList()));
        if (uniqueIds.size() > KNOWLEDGE_IMAGE_MAX_COUNT) {
            throw new IllegalArgumentException("At most " + KNOWLEDGE_IMAGE_MAX_COUNT + " images can be attached");
        }
        return uniqueIds.stream().map(this::describe).toList();
    }

    public static String formatImageAppendix(List<KnowledgeImageAttachment> images) {
        if (images == null || images.isEmpty()) {
            return "";
        }
        String names = images.stream()
                .map(KnowledgeImageAttachment::getFileName)
                .filter(name -> name != null && !name.isBlank())
                .collect(Collectors.joining(", "));
        if (names.isBlank()) {
            return "\n\nHình minh họa: " + images.size() + " ảnh đính kèm.";
        }
        return "\n\nHình minh họa đính kèm: " + names;
    }

    private GridFSFile findKnowledgeImage(String fileId) {
        if (fileId == null || fileId.isBlank() || !ObjectId.isValid(fileId.trim())) {
            throw new IllegalArgumentException("imageId is invalid");
        }
        GridFSFile file = gridFsTemplate.findOne(Query.query(Criteria.where("_id").is(new ObjectId(fileId.trim()))));
        if (file == null) {
            throw new IllegalArgumentException("Knowledge image not found: " + fileId);
        }
        String fileType = file.getMetadata() == null ? null : file.getMetadata().getString("fileType");
        if (!FILE_TYPE.equals(fileType)) {
            throw new IllegalArgumentException("File is not a knowledge image: " + fileId);
        }
        return file;
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("file is required");
        }
        long maxBytes = (long) KNOWLEDGE_IMAGE_MAX_SIZE_MB * 1024 * 1024;
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException("file exceeds max allowed size: " + KNOWLEDGE_IMAGE_MAX_SIZE_MB + " MB");
        }
        String extension = getExtension(file.getOriginalFilename());
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        boolean extensionOk = IMAGE_EXTENSIONS.contains(extension);
        boolean typeOk = IMAGE_CONTENT_TYPES.contains(contentType);
        if (!extensionOk && !typeOk) {
            throw new IllegalArgumentException("file must be a PNG, JPG, WEBP, or GIF image");
        }
    }

    private String extensionForContentType(String contentType) {
        return switch (contentType == null ? "" : contentType.toLowerCase(Locale.ROOT)) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            default -> "png";
        };
    }

    private String normalizeContentType(String contentType, String fileName) {
        if (contentType != null && !contentType.isBlank() && IMAGE_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            return contentType.toLowerCase(Locale.ROOT).equals("image/jpg") ? "image/jpeg" : contentType.toLowerCase(Locale.ROOT);
        }
        return switch (getExtension(fileName)) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            default -> "image/png";
        };
    }
}
