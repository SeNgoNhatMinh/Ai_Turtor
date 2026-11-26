package com.ragapi.harness.quiz;
import static com.ragapi.util.ValidationUtils.DEFAULT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.SHORT_TEXT_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;
import static com.ragapi.harness.util.QuizContentFilter.isAcademicQuizQuestion;
import com.ragapi.harness.util.QuizMaterialGrounding.QuizPassage;
import com.ragapi.harness.memory.StudentCourseMemoryService;
import com.ragapi.harness.review.LearningEvidenceService;
import com.ragapi.service.llm.OpenRouterChatService;

import com.ragapi.harness.model.RetrievedCourseChunk;
import com.ragapi.harness.gateway.CourseKnowledgeSearchGateway;
import com.ragapi.harness.retrieval.CourseMaterialTextSearchService;
import com.ragapi.harness.retrieval.CourseSearchResultRankingService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ragapi.dto.GenerateQuizAssignmentRequest;
import com.ragapi.dto.GenerateQuizRequest;
import com.ragapi.dto.QuizAttemptPageResponse;
import com.ragapi.dto.QuizAttemptSummary;
import com.ragapi.dto.PublishQuizAssignmentRequest;
import com.ragapi.dto.SubmitQuizRequest;
import com.ragapi.dto.TeacherReviewQuizRequest;
import com.ragapi.dto.UpdateQuizAssignmentRequest;
import com.ragapi.harness.entity.QuizAssignment;
import com.ragapi.harness.entity.QuizSession;
import com.ragapi.harness.repository.QuizAssignmentRepository;
import com.ragapi.harness.repository.QuizSessionRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.ragapi.harness.util.QuizJsonParser;
import com.ragapi.harness.util.QuizMaterialGrounding;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuizService {

    private static final int DEFAULT_QUESTION_COUNT = 5;
    private static final int MIN_QUESTION_COUNT = 3;
    private static final int MAX_QUESTION_COUNT = 10;
    private static final String STATUS_GENERATED = "GENERATED";
    private static final String STATUS_SUBMITTED = "SUBMITTED";
    private static final String ASSIGNMENT_DRAFT = "DRAFT";
    private static final String ASSIGNMENT_PUBLISHED = "PUBLISHED";

    private final QuizSessionRepository quizSessionRepository;
    private final QuizAssignmentRepository quizAssignmentRepository;
    private final CourseKnowledgeSearchGateway vectorService;
    private final CourseMaterialTextSearchService fallbackSearchService;
    private final CourseSearchResultRankingService rerankService;
    private final OpenRouterChatService chatService;
    private final StudentCourseMemoryService memoryService;
    private final LearningEvidenceService learningEvidenceService;
    private final ObjectMapper objectMapper = new ObjectMapper();


    private QuizQuestionAuthor questions() {
        return new QuizQuestionAuthor(vectorService, fallbackSearchService, rerankService, objectMapper);
    }

    public QuizSession generateQuiz(String studentId, String courseId, GenerateQuizRequest request) throws IOException {
        String safeStudentId = requireText(studentId, "studentId");
        String safeCourseId = requireText(courseId, "courseId");
        String classId = normalize(request == null ? null : request.getClassId());
        String topic = resolveTopic(request);
        int questionCount = clampQuestionCount(request == null ? null : request.getQuestionCount());

        String suggestionText = normalize(request == null ? null : request.getSuggestionText());
        String retrievalQuestion = QuizMaterialGrounding.retrievalQuery(topic, suggestionText);
        List<QuizPassage> passages = questions().retrieveQuizPassages(retrievalQuestion, safeCourseId, classId);
        if (passages.isEmpty()) {
            throw new IllegalArgumentException(
                    "Tài liệu môn chưa có đoạn khớp chủ đề này, nên mình không tạo quiz ngoài tài liệu");
        }
        log.info("Quiz passages selected (courseId={}, passages={})", safeCourseId, passages.size());

        String prompt = questions().buildQuizPrompt(
                safeCourseId,
                classId,
                topic,
                questionCount,
                QuizMaterialGrounding.formatPassages(passages)
        );
        List<QuizSession.QuizQuestion> questions = List.of();
        for (int attempt = 0; attempt < 2 && questions.size() < questionCount; attempt++) {
            String generationPrompt = attempt == 0
                    ? prompt
                    : prompt + """

                    RETRY:
                    - The previous quiz was rejected because evidenceQuote was not copied verbatim from a PASSAGE, or correctAnswer did not match an option.
                    - Copy evidenceQuote exactly from one PASSAGE body. Do not translate or paraphrase it.
                    - correctAnswer must be the full text of one option.
                    - Return fewer questions instead of inventing one.
                    - Return strictly valid JSON only. Put a comma between every field and between every object in questions.
                    """;
            String raw = chatService.generateUtility(generationPrompt);
            if (raw == null || raw.isBlank()) {
                log.warn("Quiz generation returned empty text on attempt {}", attempt + 1);
                continue;
            }
            try {
                List<QuizSession.QuizQuestion> parsed = questions().normalizeQuestions(
                        questions().parseQuizPayload(raw),
                        questionCount,
                        passages
                );
                if (parsed.size() > questions.size()) {
                    questions = parsed;
                }
            } catch (IOException parseError) {
                log.warn("Quiz JSON parse failed on attempt {}: {}", attempt + 1, parseError.getMessage());
            }
        }
        if (questions.isEmpty()) {
            throw new IllegalArgumentException(
                    "AI chưa tạo được quiz hợp lệ từ tài liệu môn học. Hãy thử lại với đúng thuật ngữ có trong tài liệu");
        }

        LocalDateTime now = LocalDateTime.now();
        QuizSession session = QuizSession.builder()
                .id(UUID.randomUUID().toString())
                .studentId(safeStudentId.trim())
                .courseId(safeCourseId.trim())
                .classId(classId)
                .topic(topic)
                .suggestionText(normalize(request == null ? null : request.getSuggestionText()))
                .quizType("SELF_PRACTICE")
                .status(STATUS_GENERATED)
                .score(0)
                .maxScore(questions.size())
                .percentage(0.0)
                .questions(questions)
                .answers(new ArrayList<>())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return quizSessionRepository.save(session);
    }

    public QuizAssignment generateAssignmentDraft(String teacherId, String courseId, GenerateQuizAssignmentRequest request) throws IOException {
        String safeTeacherId = requireText(teacherId, "teacherId");
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        GenerateQuizRequest quizRequest = new GenerateQuizRequest(
                request.getClassId(),
                request.getTopic(),
                request.getSuggestionText(),
                request.getQuestionCount()
        );
        QuizSession generated = generateQuiz(safeTeacherId, courseId, quizRequest);
        quizSessionRepository.deleteById(generated.getId());

        LocalDateTime now = LocalDateTime.now();
        QuizAssignment assignment = QuizAssignment.builder()
                .id(UUID.randomUUID().toString())
                .teacherId(safeTeacherId)
                .courseId(requireText(courseId, "courseId"))
                .classId(normalize(request.getClassId()))
                .title(resolveAssignmentTitle(request))
                .topic(generated.getTopic())
                .suggestionText(normalize(request.getSuggestionText()))
                .gradingMode("AUTO")
                .status(ASSIGNMENT_DRAFT)
                .targetType("CLASS")
                .questions(generated.getQuestions())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return quizAssignmentRepository.save(assignment);
    }

    public QuizAssignment createTeacherQuizDraft(String teacherId, String courseId, com.ragapi.dto.CreateTeacherQuizRequest request) {
        String safeTeacherId = requireText(teacherId, "teacherId");
        if (request == null) throw new IllegalArgumentException("request body is required");
        if (request.getQuestions() == null || request.getQuestions().isEmpty()) {
            throw new IllegalArgumentException("questions are required");
        }
        String gradingMode = request.getGradingMode() == null || request.getGradingMode().isBlank()
                ? "TEACHER_MANUAL" : request.getGradingMode().trim().toUpperCase(Locale.ROOT);
        if (!List.of("TEACHER_MANUAL", "AI_ASSISTED").contains(gradingMode)) {
            throw new IllegalArgumentException("gradingMode must be TEACHER_MANUAL or AI_ASSISTED");
        }
        List<QuizSession.QuizQuestion> questions = copyQuestions(request.getQuestions());
        for (QuizSession.QuizQuestion question : questions) {
            requireText(question.getQuestionText(), "questionText");
            requireText(question.getCorrectAnswer(), "correctAnswer");
            if (question.getOptions() == null || question.getOptions().size() < 2) {
                throw new IllegalArgumentException("Each teacher quiz question requires at least two options");
            }
            if (question.getQuestionId() == null || question.getQuestionId().isBlank()) {
                question.setQuestionId(UUID.randomUUID().toString());
            }
            question.setType("MULTIPLE_CHOICE");
        }
        LocalDateTime now = LocalDateTime.now();
        return quizAssignmentRepository.save(QuizAssignment.builder()
                .id(UUID.randomUUID().toString())
                .teacherId(safeTeacherId)
                .courseId(requireText(courseId, "courseId"))
                .classId(normalize(request.getClassId()))
                .title(requireMaxLength(request.getTitle(), "title", SHORT_TEXT_MAX_LENGTH))
                .topic(requireMaxLength(request.getTopic(), "topic", SHORT_TEXT_MAX_LENGTH))
                .gradingMode(gradingMode)
                .status(ASSIGNMENT_DRAFT)
                .targetType("CLASS")
                .questions(questions)
                .createdAt(now)
                .updatedAt(now)
                .build());
    }

    public QuizAssignment updateAssignment(String assignmentId, UpdateQuizAssignmentRequest request) {
        QuizAssignment assignment = requireAssignment(assignmentId);
        if (ASSIGNMENT_PUBLISHED.equalsIgnoreCase(assignment.getStatus())) {
            throw new IllegalArgumentException("Published quiz assignment cannot be edited");
        }
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        if (request.getTitle() != null) assignment.setTitle(requireMaxLength(request.getTitle(), "title", SHORT_TEXT_MAX_LENGTH));
        if (request.getTopic() != null) assignment.setTopic(requireMaxLength(request.getTopic(), "topic", SHORT_TEXT_MAX_LENGTH));
        if (request.getSuggestionText() != null) assignment.setSuggestionText(requireMaxLength(request.getSuggestionText(), "suggestionText", SHORT_TEXT_MAX_LENGTH));
        if (request.getQuestions() != null) assignment.setQuestions(request.getQuestions());
        assignment.setUpdatedAt(LocalDateTime.now());
        return quizAssignmentRepository.save(assignment);
    }

    public void deleteAssignment(String assignmentId) {
        QuizAssignment assignment = requireAssignment(assignmentId);
        if (ASSIGNMENT_PUBLISHED.equalsIgnoreCase(assignment.getStatus())) {
            throw new IllegalArgumentException("Published quiz assignment cannot be deleted");
        }
        quizAssignmentRepository.deleteById(assignment.getId());
    }

    public QuizAssignment publishAssignment(String assignmentId, PublishQuizAssignmentRequest request) {
        QuizAssignment assignment = requireAssignment(assignmentId);
        if (assignment.getQuestions() == null || assignment.getQuestions().isEmpty()) {
            throw new IllegalArgumentException("Quiz assignment has no questions");
        }
        String targetType = request == null || request.getTargetType() == null || request.getTargetType().isBlank()
                ? "CLASS"
                : request.getTargetType().trim().toUpperCase(Locale.ROOT);
        if (!"CLASS".equals(targetType) && !"SELECTED_STUDENTS".equals(targetType)) {
            throw new IllegalArgumentException("targetType must be CLASS or SELECTED_STUDENTS");
        }
        List<String> targetStudentIds = request == null || request.getTargetStudentIds() == null
                ? List.of()
                : request.getTargetStudentIds().stream()
                        .map(this::normalize)
                        .filter(value -> value != null)
                        .distinct()
                        .toList();
        if ("SELECTED_STUDENTS".equals(targetType) && targetStudentIds.isEmpty()) {
            throw new IllegalArgumentException("targetStudentIds is required when targetType is SELECTED_STUDENTS");
        }
        LocalDateTime now = LocalDateTime.now();
        assignment.setTargetType(targetType);
        assignment.setTargetStudentIds(targetStudentIds);
        assignment.setStatus(ASSIGNMENT_PUBLISHED);
        assignment.setPublishedAt(now);
        assignment.setUpdatedAt(now);
        return quizAssignmentRepository.save(assignment);
    }

    public List<QuizAssignment> listTeacherAssignments(String teacherId) {
        return quizAssignmentRepository.findByTeacherIdOrderByCreatedAtDesc(requireText(teacherId, "teacherId"));
    }

    public List<QuizAssignment> listPublishedAssignmentsForStudent(String studentId, String courseId, String classId) {
        String safeStudentId = requireText(studentId, "studentId");
        String safeCourseId = requireText(courseId, "courseId");
        List<QuizAssignment> assignments = classId == null || classId.isBlank()
                ? quizAssignmentRepository.findByCourseIdAndStatusOrderByPublishedAtDesc(safeCourseId, ASSIGNMENT_PUBLISHED)
                : quizAssignmentRepository.findByCourseIdAndClassIdAndStatusOrderByPublishedAtDesc(safeCourseId, classId.trim(), ASSIGNMENT_PUBLISHED);
        return assignments.stream()
                .filter(assignment -> isAssignedToStudent(assignment, safeStudentId))
                .toList();
    }

    public QuizSession startAssignmentAttempt(String assignmentId, String studentId) {
        QuizAssignment assignment = requireAssignment(assignmentId);
        if (!ASSIGNMENT_PUBLISHED.equalsIgnoreCase(assignment.getStatus())) {
            throw new IllegalArgumentException("Quiz assignment is not published");
        }
        String safeStudentId = requireText(studentId, "studentId");
        if (!isAssignedToStudent(assignment, safeStudentId)) {
            throw new IllegalArgumentException("Quiz assignment is not assigned to this student");
        }
        LocalDateTime now = LocalDateTime.now();
        QuizSession session = QuizSession.builder()
                .id(UUID.randomUUID().toString())
                .studentId(safeStudentId)
                .courseId(assignment.getCourseId())
                .classId(assignment.getClassId())
                .topic(assignment.getTopic())
                .suggestionText(assignment.getSuggestionText())
                .assignmentId(assignment.getId())
                .quizType("ASSIGNED")
                .teacherId(assignment.getTeacherId())
                .gradingMode(assignment.getGradingMode())
                .status(STATUS_GENERATED)
                .score(0)
                .maxScore(assignment.getQuestions().size())
                .percentage(0.0)
                .questions(copyQuestions(assignment.getQuestions()))
                .answers(new ArrayList<>())
                .createdAt(now)
                .updatedAt(now)
                .build();
        return quizSessionRepository.save(session);
    }

    public QuizSession teacherReviewQuiz(String quizSessionId, TeacherReviewQuizRequest request,
                                         String requesterId, String requesterRole) {
        QuizSession session = getQuiz(quizSessionId);
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }
        if (!"ASSIGNED".equalsIgnoreCase(session.getQuizType())) {
            throw new IllegalArgumentException("Only assigned quiz attempts require teacher review");
        }
        if (!STATUS_SUBMITTED.equalsIgnoreCase(session.getStatus())) {
            throw new IllegalArgumentException("Quiz attempt must be submitted before teacher review");
        }
        requireTeacherOwnership(session.getTeacherId(), requesterId, requesterRole);
        if (!"PENDING".equalsIgnoreCase(effectiveReviewStatus(session))) {
            throw new IllegalArgumentException("Only pending quiz attempts can be reviewed");
        }
        Integer reviewedScore = request.getReviewedScore();
        if (reviewedScore == null || reviewedScore < 0 || reviewedScore > session.getMaxScore()) {
            throw new IllegalArgumentException("reviewedScore must be between 0 and maxScore");
        }
        session.setTeacherReviewedScore(reviewedScore);
        session.setTeacherFeedback(normalize(request.getFeedback()));
        session.setTeacherReviewStatus("REVIEWED");
        session.setTeacherReviewedAt(LocalDateTime.now());
        session.setUpdatedAt(LocalDateTime.now());
        QuizSession saved = quizSessionRepository.save(session);
        try {
            learningEvidenceService.recordEligibleQuizSubmission(saved);
        } catch (Exception error) {
            log.warn("Could not refresh learning evidence after teacher review for quiz {}: {}",
                    saved.getId(), error.getMessage());
        }
        return saved;
    }

    public QuizAttemptPageResponse listTeacherQuizAttempts(
            String teacherId,
            String requesterId,
            String requesterRole,
            String status,
            String reviewStatus,
            String courseId,
            String classId,
            String assignmentId,
            String studentId,
            int page,
            int size
    ) {
        String safeTeacherId = requireText(teacherId, "teacherId");
        requireTeacherOwnership(safeTeacherId, requesterId, requesterRole);
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));

        List<QuizSession> filtered = quizSessionRepository.findByTeacherIdOrderBySubmittedAtDesc(safeTeacherId).stream()
                .filter(session -> "ASSIGNED".equalsIgnoreCase(session.getQuizType()))
                .filter(session -> matches(status, session.getStatus()))
                .filter(session -> matches(reviewStatus, effectiveReviewStatus(session)))
                .filter(session -> matches(courseId, session.getCourseId()))
                .filter(session -> matches(classId, session.getClassId()))
                .filter(session -> matches(assignmentId, session.getAssignmentId()))
                .filter(session -> matches(studentId, session.getStudentId()))
                .toList();

        int from = Math.min(filtered.size(), safePage * safeSize);
        int to = Math.min(filtered.size(), from + safeSize);
        List<QuizAttemptSummary> attempts = filtered.subList(from, to).stream()
                .map(this::toAttemptSummary)
                .toList();
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil(filtered.size() / (double) safeSize);
        return QuizAttemptPageResponse.builder()
                .teacherId(safeTeacherId)
                .page(safePage)
                .size(safeSize)
                .totalElements(filtered.size())
                .totalPages(totalPages)
                .attempts(attempts)
                .build();
    }
    public QuizSession submitQuiz(String quizSessionId, SubmitQuizRequest request) {
        String safeQuizId = requireText(quizSessionId, "quizSessionId");
        if (request == null || request.getAnswers() == null || request.getAnswers().isEmpty()) {
            throw new IllegalArgumentException("answers are required");
        }

        QuizSession session = quizSessionRepository.findById(safeQuizId)
                .orElseThrow(() -> new IllegalArgumentException("Quiz session not found"));
        if (!STATUS_GENERATED.equalsIgnoreCase(session.getStatus())) {
            throw new IllegalArgumentException("Quiz attempt has already been submitted");
        }

        Map<String, String> submitted = request.getAnswers().stream()
                .filter(answer -> answer.getQuestionId() != null)
                .collect(Collectors.toMap(
                        answer -> answer.getQuestionId().trim(),
                        answer -> answer.getSelectedAnswer() == null ? "" : answer.getSelectedAnswer().trim(),
                        (first, second) -> second
                ));

        boolean manual = "TEACHER_MANUAL".equalsIgnoreCase(session.getGradingMode());
        int score = 0;
        List<QuizSession.QuizAnswer> checkedAnswers = new ArrayList<>();
        for (QuizSession.QuizQuestion question : session.getQuestions()) {
            String selected = submitted.getOrDefault(question.getQuestionId(), "");
            boolean correct = !manual && isCorrect(selected, question.getCorrectAnswer());
            if (correct) {
                score++;
            }
            checkedAnswers.add(QuizSession.QuizAnswer.builder()
                    .questionId(question.getQuestionId())
                    .selectedAnswer(selected)
                    .correct(manual ? null : correct)
                    .correctAnswer(manual ? null : question.getCorrectAnswer())
                    .explanation(manual ? null : question.getExplanation())
                    .build());
        }

        int maxScore = session.getQuestions() == null ? 0 : session.getQuestions().size();
        double percentage = maxScore == 0 ? 0.0 : Math.round((score * 10000.0 / maxScore)) / 100.0;
        LocalDateTime now = LocalDateTime.now();
        session.setAnswers(checkedAnswers);
        session.setScore(manual ? null : score);
        session.setMaxScore(maxScore);
        session.setPercentage(manual ? null : percentage);
        session.setStatus(STATUS_SUBMITTED);
        session.setTeacherReviewStatus("ASSIGNED".equalsIgnoreCase(session.getQuizType()) ? "PENDING" : "NOT_REQUIRED");
        session.setSubmittedAt(now);
        session.setUpdatedAt(now);

        QuizSession saved = quizSessionRepository.save(session);
        memoryService.recordQuizResult(
                saved.getStudentId(),
                saved.getCourseId(),
                saved.getClassId(),
                saved.getTopic(),
                manual ? 0.0 : percentage
        );
        try {
            learningEvidenceService.recordEligibleQuizSubmission(saved);
        } catch (Exception error) {
            log.warn("Could not record learning evidence for quiz {}: {}",
                    saved.getId(), error.getMessage());
        }
        return saved;
    }

    private QuizAttemptSummary toAttemptSummary(QuizSession session) {
        boolean reviewed = "REVIEWED".equalsIgnoreCase(session.getTeacherReviewStatus())
                && session.getTeacherReviewedScore() != null;
        int finalScore = reviewed ? session.getTeacherReviewedScore() : value(session.getScore());
        int maxScore = value(session.getMaxScore());
        double finalPercentage = maxScore == 0 ? 0.0 : Math.round(finalScore * 10000.0 / maxScore) / 100.0;
        return QuizAttemptSummary.builder()
                .quizSessionId(session.getId())
                .assignmentId(session.getAssignmentId())
                .studentId(session.getStudentId())
                .teacherId(session.getTeacherId())
                .courseId(session.getCourseId())
                .classId(session.getClassId())
                .topic(session.getTopic())
                .quizType(session.getQuizType())
                .status(session.getStatus())
                .teacherReviewStatus(effectiveReviewStatus(session))
                .autoScore(session.getScore())
                .teacherReviewedScore(session.getTeacherReviewedScore())
                .finalScore(finalScore)
                .maxScore(session.getMaxScore())
                .autoPercentage(session.getPercentage())
                .finalPercentage(finalPercentage)
                .teacherFeedback(session.getTeacherFeedback())
                .createdAt(session.getCreatedAt())
                .submittedAt(session.getSubmittedAt())
                .teacherReviewedAt(session.getTeacherReviewedAt())
                .build();
    }

    private void requireTeacherOwnership(String ownerTeacherId, String requesterId, String requesterRole) {
        if ("ADMIN".equalsIgnoreCase(requesterRole)) return;
        if (requesterId == null || !requesterId.equals(ownerTeacherId)) {
            throw new SecurityException("Teacher is not allowed to access this quiz attempt");
        }
    }

    private boolean matches(String filter, String value) {
        return filter == null || filter.isBlank() || filter.trim().equalsIgnoreCase(value == null ? "" : value);
    }

    private String effectiveReviewStatus(QuizSession session) {
        if (session.getTeacherReviewStatus() != null && !session.getTeacherReviewStatus().isBlank()) {
            return session.getTeacherReviewStatus();
        }
        if ("ASSIGNED".equalsIgnoreCase(session.getQuizType())
                && STATUS_SUBMITTED.equalsIgnoreCase(session.getStatus())) {
            return "PENDING";
        }
        return session.getTeacherReviewStatus();
    }

    private int value(Integer number) {
        return number == null ? 0 : number;
    }

    public QuizSession getQuiz(String quizSessionId) {
        return quizSessionRepository.findById(requireText(quizSessionId, "quizSessionId"))
                .orElseThrow(() -> new IllegalArgumentException("Quiz session not found"));
    }

    public List<QuizSession> listStudentCourseQuizzes(String studentId, String courseId) {
        return quizSessionRepository.findByStudentIdAndCourseIdOrderByCreatedAtDesc(
                requireText(studentId, "studentId"),
                requireText(courseId, "courseId")
        );
    }

    private QuizAssignment requireAssignment(String assignmentId) {
        return quizAssignmentRepository.findById(requireText(assignmentId, "assignmentId"))
                .orElseThrow(() -> new IllegalArgumentException("Quiz assignment not found"));
    }

    private String resolveAssignmentTitle(GenerateQuizAssignmentRequest request) {
        String title = normalize(request.getTitle());
        if (title != null) {
            return requireMaxLength(title, "title", SHORT_TEXT_MAX_LENGTH);
        }
        return "Quiz: " + resolveTopic(new GenerateQuizRequest(
                request.getClassId(), request.getTopic(), request.getSuggestionText(), request.getQuestionCount()
        ));
    }

    private boolean isAssignedToStudent(QuizAssignment assignment, String studentId) {
        if ("SELECTED_STUDENTS".equalsIgnoreCase(assignment.getTargetType())) {
            return assignment.getTargetStudentIds() != null
                    && assignment.getTargetStudentIds().stream().anyMatch(id -> id.equalsIgnoreCase(studentId));
        }
        return true;
    }

    private List<QuizSession.QuizQuestion> copyQuestions(List<QuizSession.QuizQuestion> questions) {
        if (questions == null) {
            return new ArrayList<>();
        }
        return questions.stream()
                .map(question -> QuizSession.QuizQuestion.builder()
                        .questionId(UUID.randomUUID().toString())
                        .type(question.getType())
                        .questionText(question.getQuestionText())
                        .options(question.getOptions() == null ? List.of() : new ArrayList<>(question.getOptions()))
                        .correctAnswer(question.getCorrectAnswer())
                        .explanation(question.getExplanation())
                        .sourceMaterialIds(question.getSourceMaterialIds() == null ? List.of() : new ArrayList<>(question.getSourceMaterialIds()))
                        .build())
                .toList();
    }
    private String resolveTopic(GenerateQuizRequest request) {
        String topic = normalize(request == null ? null : request.getTopic());
        if (topic != null) {
            return requireMaxLength(topic, "topic", SHORT_TEXT_MAX_LENGTH);
        }
        String suggestion = normalize(request == null ? null : request.getSuggestionText());
        if (suggestion != null) {
            return requireMaxLength(suggestion, "suggestionText", SHORT_TEXT_MAX_LENGTH);
        }
        throw new IllegalArgumentException("topic or suggestionText is required");
    }

    private int clampQuestionCount(Integer questionCount) {
        int count = questionCount == null ? DEFAULT_QUESTION_COUNT : questionCount;
        return Math.max(MIN_QUESTION_COUNT, Math.min(MAX_QUESTION_COUNT, count));
    }

    private boolean isCorrect(String selectedAnswer, String correctAnswer) {
        return normalizeForCompare(selectedAnswer).equals(normalizeForCompare(correctAnswer));
    }

    private String normalizeForCompare(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    public QuizSession toStudentView(QuizSession session) {
        if (session == null) {
            return session;
        }

        boolean hideKey = STATUS_GENERATED.equalsIgnoreCase(session.getStatus())
                || (("TEACHER_MANUAL".equalsIgnoreCase(session.getGradingMode())
                || "AI_ASSISTED".equalsIgnoreCase(session.getGradingMode()))
                && !"REVIEWED".equalsIgnoreCase(session.getTeacherReviewStatus()));
        if (!hideKey) return session;

        List<QuizSession.QuizQuestion> safeQuestions = new ArrayList<>();
        if (session.getQuestions() != null) {
            for (QuizSession.QuizQuestion question : session.getQuestions()) {
                safeQuestions.add(QuizSession.QuizQuestion.builder()
                        .questionId(question.getQuestionId())
                        .type(question.getType())
                        .questionText(question.getQuestionText())
                        .options(question.getOptions())
                        .correctAnswer(null)
                        .explanation(null)
                        .sourceMaterialIds(question.getSourceMaterialIds())
                        .build());
            }
        }

        return QuizSession.builder()
                .id(session.getId())
                .studentId(session.getStudentId())
                .courseId(session.getCourseId())
                .classId(session.getClassId())
                .topic(session.getTopic())
                .suggestionText(session.getSuggestionText())
                .assignmentId(session.getAssignmentId())
                .quizType(session.getQuizType())
                .teacherId(session.getTeacherId())
                .gradingMode(session.getGradingMode())
                .status(session.getStatus())
                .score(session.getScore())
                .maxScore(session.getMaxScore())
                .percentage(session.getPercentage())
                .teacherReviewStatus(session.getTeacherReviewStatus())
                .teacherReviewedScore(session.getTeacherReviewedScore())
                .teacherFeedback(session.getTeacherFeedback())
                .teacherReviewedAt(session.getTeacherReviewedAt())
                .questions(safeQuestions)
                .answers(List.of())
                .createdAt(session.getCreatedAt())
                .submittedAt(session.getSubmittedAt())
                .updatedAt(session.getUpdatedAt())
                .build();
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

}
