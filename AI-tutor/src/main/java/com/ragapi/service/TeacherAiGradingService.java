package com.ragapi.service;

import com.ragapi.entity.Assignment;
import com.ragapi.entity.AssignmentSubmission;
import com.ragapi.repository.AssignmentRepository;
import com.ragapi.repository.AssignmentSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.ragapi.util.ValidationUtils.requireText;

@Service
@RequiredArgsConstructor
public class TeacherAiGradingService {
    private static final Pattern SCORE = Pattern.compile("(?im)^\\s*SCORE\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)");
    private static final int MAX_PROMPT_TEXT = 30000;

    private final AssignmentRepository assignments;
    private final AssignmentSubmissionRepository submissions;
    private final AssignmentFileStorageService files;
    private final OpenRouterChatService llm;
    private final RealtimeEventService events;

    public Assignment uploadAnswerKey(String assignmentId, String teacherId, MultipartFile file) throws IOException {
        Assignment assignment = requireTeacherAssignment(assignmentId, teacherId);
        String fileId = files.storeAnswerKeyFile(file, assignment.getId());
        assignment.setAnswerKeyFileId(fileId);
        assignment.setAnswerKeyFileName(file.getOriginalFilename());
        assignment.setAnswerKeyContentType(file.getContentType());
        assignment.setAnswerKeyFileSize(file.getSize());
        assignment.setAnswerKeyUploaded(true);
        assignment.setUpdatedAt(LocalDateTime.now());
        return assignments.save(assignment);
    }

    public AssignmentSubmission grade(String submissionId, String teacherId) throws Exception {
        AssignmentSubmission submission = submissions.findById(requireText(submissionId, "submissionId"))
                .orElseThrow(() -> new IllegalArgumentException("Submission not found"));
        Assignment assignment = requireTeacherAssignment(submission.getAssignmentId(), teacherId);
        if (assignment.getAnswerKeyFileId() == null) throw new IllegalArgumentException("Upload an answer key before AI grading");
        if (submission.getSubmittedFileId() == null) throw new IllegalArgumentException("Submission file is missing");

        submission.setAiGradingStatus("PROCESSING");
        submissions.save(submission);
        events.publishToUser(teacherId, "AI_GRADING", "ASSIGNMENT_SUBMISSION", submission.getId(), "PROCESSING", Map.of());

        try {
            String key = extract(files.loadByFileId(assignment.getAnswerKeyFileId()));
            String answer = extract(files.loadByFileId(submission.getSubmittedFileId()));
            double maxScore = assignment.getMaxScore() == null ? 10.0 : assignment.getMaxScore();
            String prompt = """
                    You are assisting a teacher with grading. Treat the answer key as the authority.
                    Return plain text in exactly this form:
                    SCORE: <number from 0 to %.2f>
                    FEEDBACK: <concise Vietnamese feedback with evidence; do not invent missing content>

                    ANSWER KEY:
                    %s

                    STUDENT SUBMISSION:
                    %s
                    """.formatted(maxScore, cap(key), cap(answer));
            String raw = llm.generate(prompt);
            double suggested = parseScore(raw, maxScore);
            submission.setAiGradingStatus("SUGGESTED");
            submission.setAiSuggestedScore(suggested);
            submission.setAiFeedback(parseFeedback(raw));
            submission.setAiGradingRaw(raw == null ? "" : raw.substring(0, Math.min(raw.length(), 10000)));
            submission.setAiGradedAt(LocalDateTime.now());
            submission.setUpdatedAt(LocalDateTime.now());
            AssignmentSubmission saved = submissions.save(submission);
            events.publishToUser(teacherId, "AI_GRADING_COMPLETED", "ASSIGNMENT_SUBMISSION", saved.getId(), "SUGGESTED", Map.of(
                    "suggestedScore", suggested, "maxScore", maxScore));
            return saved;
        } catch (Exception e) {
            submission.setAiGradingStatus("FAILED");
            submission.setAiFeedback(e.getMessage());
            submission.setUpdatedAt(LocalDateTime.now());
            submissions.save(submission);
            events.publishToUser(teacherId, "AI_GRADING_FAILED", "ASSIGNMENT_SUBMISSION", submission.getId(), "FAILED", Map.of(
                    "message", e.getMessage() == null ? "AI grading failed" : e.getMessage()));
            throw e;
        }
    }

    private Assignment requireTeacherAssignment(String assignmentId, String teacherId) {
        Assignment assignment = assignments.findById(requireText(assignmentId, "assignmentId"))
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
        if (!requireText(teacherId, "teacherId").equals(assignment.getTeacherId())) {
            throw new IllegalArgumentException("Only the class teacher can access the answer key or AI grading");
        }
        return assignment;
    }

    private String extract(GridFsResource resource) throws IOException {
        byte[] bytes = resource.getInputStream().readAllBytes();
        String name = resource.getFilename() == null ? "" : resource.getFilename().toLowerCase();
        if (name.endsWith(".docx")) {
            try (XWPFDocument doc = new XWPFDocument(new java.io.ByteArrayInputStream(bytes))) {
                StringBuilder text = new StringBuilder();
                doc.getParagraphs().forEach(p -> text.append(p.getText()).append('\n'));
                doc.getTables().forEach(t -> t.getRows().forEach(r -> r.getTableCells()
                        .forEach(c -> text.append(c.getText()).append('\t'))));
                return text.toString();
            }
        }
        if (name.endsWith(".pdf")) {
            try (PDDocument doc = Loader.loadPDF(bytes)) { return new PDFTextStripper().getText(doc); }
        }
        if (name.endsWith(".txt")) return new String(bytes, StandardCharsets.UTF_8);
        throw new IllegalArgumentException("AI grading supports DOCX, PDF or TXT files only");
    }

    private String cap(String value) { return value.substring(0, Math.min(value.length(), MAX_PROMPT_TEXT)); }

    private double parseScore(String raw, double maxScore) {
        Matcher matcher = SCORE.matcher(raw == null ? "" : raw);
        if (!matcher.find()) throw new IllegalArgumentException("AI response does not contain SCORE");
        return Math.max(0, Math.min(maxScore, Double.parseDouble(matcher.group(1))));
    }

    private String parseFeedback(String raw) {
        if (raw == null) return "";
        int index = raw.toUpperCase().indexOf("FEEDBACK:");
        return index < 0 ? raw.trim() : raw.substring(index + 9).trim();
    }
}
