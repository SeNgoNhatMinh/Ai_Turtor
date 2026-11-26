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
import com.ragapi.dto.GenerateQuizRequest;
import com.ragapi.dto.SubmitQuizRequest;
import com.ragapi.harness.entity.QuizSession;
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

    private final QuizSessionRepository quizSessionRepository;
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
        // Teacher-assigned quizzes and their manual review were removed; nothing waits for a teacher.
        session.setTeacherReviewStatus("NOT_REQUIRED");
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

        // The key stays hidden only until the student submits. Answers used to wait for a
        // teacher review on assigned quizzes; that review no longer exists, so older
        // assigned attempts would otherwise never show their answers.
        boolean hideKey = STATUS_GENERATED.equalsIgnoreCase(session.getStatus());
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
