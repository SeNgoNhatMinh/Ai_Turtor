package com.ragapi.controller;

import com.ragapi.dto.CodeMentorRequest;
import com.ragapi.service.CodeMentorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;

import static com.ragapi.util.ValidationUtils.validateFile;

@Slf4j
@RestController
@RequestMapping("/api/code-mentor")
@RequiredArgsConstructor
@Tag(name = "Code Mentor", description = "Dedicated code debugging mentor APIs")
public class CodeMentorController {

    private final CodeMentorService codeMentorService;

    @Value("${upload.code.max-size-mb:2}")
    private long maxCodeUploadMb;

    private static final Set<String> CODE_EXTENSIONS = Set.of(
            "java", "kt", "py", "js", "ts", "jsx", "tsx", "html", "css", "scss",
            "json", "xml", "yml", "yaml", "sql", "txt", "log", "md", "properties"
    );

    private static final Set<String> CODE_CONTENT_TYPES = Set.of(
            "text/plain", "text/x-java-source", "application/json", "application/xml",
            "text/xml", "text/html", "text/css", "application/x-yaml", "application/octet-stream"
    );

    @PostMapping("/query")
    @Operation(summary = "Ask the dedicated Code Mentor")
    public ResponseEntity<?> query(@RequestBody CodeMentorRequest request) {
        try {
            return ResponseEntity.ok(codeMentorService.mentor(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Code mentor query failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Code Mentor error: " + e.getMessage()));
        }
    }

    @PostMapping(
            value = "/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @Operation(summary = "Upload a code file and ask the dedicated Code Mentor")
    public ResponseEntity<?> upload(
            @RequestParam(required = false) String studentId,
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String classId,
            @RequestParam(required = false) String question,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) Boolean assignmentRelated,
            @RequestParam(required = false) String conversationId,
            @Parameter(description = "Code file to inspect", required = true, schema = @Schema(type = "string", format = "binary"))
            @RequestPart("file") MultipartFile file
    ) {
        try {
            validateFile(file, "file", maxCodeUploadMb, CODE_EXTENSIONS, CODE_CONTENT_TYPES);

            CodeMentorRequest request = new CodeMentorRequest();
            request.setStudentId(studentId);
            request.setCourseId(courseId);
            request.setClassId(classId);
            request.setQuestion(question);
            request.setLanguage(language);
            request.setAssignmentRelated(assignmentRelated);
            request.setConversationId(conversationId);
            request.setCode(new String(file.getBytes(), StandardCharsets.UTF_8));

            return ResponseEntity.ok(codeMentorService.mentor(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Code mentor upload failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cannot process code file: " + e.getMessage()));
        }
    }
}