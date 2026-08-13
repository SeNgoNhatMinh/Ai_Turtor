package com.ragapi.service;

import com.mongodb.client.gridfs.model.GridFSFile;
import lombok.RequiredArgsConstructor;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static com.ragapi.util.ValidationUtils.validateFile;

@Service
@RequiredArgsConstructor
public class AssignmentFileStorageService {

    private static final Set<String> ASSIGNMENT_EXTENSIONS = Set.of(
            "zip", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx",
            "txt", "md", "java", "py", "js", "ts", "html", "css"
    );

    private final GridFsTemplate gridFsTemplate;

    @Value("${upload.assignment.max-size-mb:50}")
    private long maxAssignmentUploadMb;

    public String storeAssignmentFile(MultipartFile file, String assignmentId) throws IOException {
        return store(file, "ASSIGNMENT", assignmentId, null);
    }

    public String storeSubmissionFile(MultipartFile file, String assignmentId, String submissionId) throws IOException {
        return store(file, "SUBMISSION", assignmentId, submissionId);
    }

    public String storeAnswerKeyFile(MultipartFile file, String assignmentId) throws IOException {
        validateFile(file, "answerKey", maxAssignmentUploadMb, Set.of("docx", "pdf", "txt"), Set.of());
        return store(file, "ANSWER_KEY", assignmentId, null);
    }

    public GridFsResource loadByFileId(String fileId) {
        GridFSFile file = gridFsTemplate.findOne(Query.query(Criteria.where("_id").is(new ObjectId(fileId))));
        if (file == null) {
            throw new IllegalArgumentException("File not found: " + fileId);
        }
        return gridFsTemplate.getResource(file);
    }

    private String store(MultipartFile file, String fileType, String assignmentId, String submissionId) throws IOException {
        validateFile(file, "file", maxAssignmentUploadMb, ASSIGNMENT_EXTENSIONS, Set.of());
        if ("ASSIGNMENT".equals(fileType) && extension(file.getOriginalFilename()).equals("zip")) {
            validateDocxBundle(file);
        }

        org.bson.Document metadata = new org.bson.Document()
                .append("fileType", fileType)
                .append("assignmentId", assignmentId);

        if (submissionId != null) {
            metadata.append("submissionId", submissionId);
        }

        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        ObjectId fileId = gridFsTemplate.store(
                file.getInputStream(),
                file.getOriginalFilename(),
                contentType,
                metadata
        );

        return fileId.toHexString();
    }

    private void validateDocxBundle(MultipartFile file) throws IOException {
        int fileCount = 0;
        try (ZipInputStream zip = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName().replace('\\', '/');
                if (name.startsWith("/") || name.contains("../")) {
                    throw new IllegalArgumentException("ZIP contains an unsafe path: " + name);
                }
                if (entry.isDirectory()) continue;
                fileCount++;
                if (fileCount > 100) throw new IllegalArgumentException("ZIP may contain at most 100 DOCX files");
                if (!extension(name).equals("docx")) {
                    throw new IllegalArgumentException("Teacher ZIP may contain DOCX files only: " + name);
                }
            }
        }
        if (fileCount == 0) throw new IllegalArgumentException("ZIP must contain at least one DOCX file");
    }

    private String extension(String name) {
        if (name == null) return "";
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase();
    }
}
