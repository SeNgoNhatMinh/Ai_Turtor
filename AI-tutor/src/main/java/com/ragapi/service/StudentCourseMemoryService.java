package com.ragapi.service;

import com.ragapi.dto.UpdateCaseMemoryRequest;
import com.ragapi.dto.UpdateStudentCourseMemoryRequest;
import com.ragapi.dto.UpdateUserMemoryRequest;
import com.ragapi.entity.CaseMemory;
import com.ragapi.entity.StudentCourseMemory;
import com.ragapi.entity.UserMemory;
import com.ragapi.repository.CaseMemoryRepository;
import com.ragapi.repository.StudentCourseMemoryRepository;
import com.ragapi.repository.UserMemoryRepository;
import com.ragapi.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StudentCourseMemoryService {

    private static final int MAX_RECENT_QUESTIONS = 20;
    private static final int MAX_RECENT_ITEMS = 20;
    private static final int MAX_PINNED_SUGGESTIONS = 20;

    private final StudentCourseMemoryRepository repository;
    private final UserMemoryRepository userMemoryRepository;
    private final CaseMemoryRepository caseMemoryRepository;

    public StudentCourseMemory getOrCreateMemory(String studentId, String courseId) {
        validateScope(studentId, courseId);

        return repository.findByStudentIdAndCourseId(studentId, courseId)
                .map(this::sanitizeExistingMemory)
                .orElseGet(() -> {
                    LocalDateTime now = LocalDateTime.now();
                    StudentCourseMemory memory = StudentCourseMemory.builder()
                            .studentId(studentId.trim())
                            .courseId(courseId.trim())
                            .createdAt(now)
                            .updatedAt(now)
                            .build();
                    return repository.save(memory);
                });
    }

    public StudentCourseMemory updateMemory(
            String studentId,
            String courseId,
            UpdateStudentCourseMemoryRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("request body is required");
        }

        StudentCourseMemory memory = getOrCreateMemory(studentId, courseId);

        if (request.getClassId() != null) {
            memory.setClassId(normalize(request.getClassId()));
        }
        if (request.getSummary() != null) {
            memory.setSummary(TextSanitizer.clean(request.getSummary()));
        }
        if (request.getWeakTopics() != null) {
            memory.setWeakTopics(cleanList(request.getWeakTopics()));
        }
        if (request.getLearnedTopics() != null) {
            memory.setLearnedTopics(cleanList(request.getLearnedTopics()));
        }
        if (request.getRecentQuestions() != null) {
            memory.setRecentQuestions(mergeRecentQuestions(memory.getRecentQuestions(), request.getRecentQuestions()));
        }
        if (request.getRecentAnswers() != null) {
            memory.setRecentAnswers(cleanAnswers(request.getRecentAnswers()));
        }
        if (request.getImproveSuggestions() != null) {
            memory.setImproveSuggestions(cleanImproveSuggestions(request.getImproveSuggestions()));
        }
        if (request.getPinnedImproveSuggestions() != null) {
            memory.setPinnedImproveSuggestions(trimPinned(cleanList(request.getPinnedImproveSuggestions())));
        }

        memory.setUpdatedAt(LocalDateTime.now());
        return repository.save(memory);
    }

    public List<StudentCourseMemory> listCourseMemories(String courseId, String classId) {
        if (courseId == null || courseId.isBlank()) {
            throw new IllegalArgumentException("courseId is required");
        }
        if (classId != null && !classId.isBlank()) {
            return repository.findByCourseIdAndClassId(courseId.trim(), classId.trim());
        }
        return repository.findByCourseId(courseId.trim());
    }
    public StudentCourseMemory pinImproveSuggestion(String studentId, String courseId, String suggestion) {
        String normalized = normalize(suggestion);
        if (normalized == null) {
            throw new IllegalArgumentException("suggestion is required");
        }

        StudentCourseMemory memory = getOrCreateMemory(studentId, courseId);
        List<String> pinned = memory.getPinnedImproveSuggestions() != null
                ? new ArrayList<>(memory.getPinnedImproveSuggestions())
                : new ArrayList<>();

        if (pinned.stream().noneMatch(item -> item.equalsIgnoreCase(normalized))) {
            pinned.add(normalized);
        }

        memory.setPinnedImproveSuggestions(trimPinned(pinned));
        memory.setUpdatedAt(LocalDateTime.now());
        return repository.save(memory);
    }

    public StudentCourseMemory unpinImproveSuggestion(String studentId, String courseId, String suggestion) {
        String normalized = normalize(suggestion);
        if (normalized == null) {
            throw new IllegalArgumentException("suggestion is required");
        }

        StudentCourseMemory memory = getOrCreateMemory(studentId, courseId);
        List<String> pinned = memory.getPinnedImproveSuggestions() != null
                ? new ArrayList<>(memory.getPinnedImproveSuggestions())
                : new ArrayList<>();
        pinned.removeIf(item -> item.equalsIgnoreCase(normalized));

        memory.setPinnedImproveSuggestions(pinned);
        memory.setUpdatedAt(LocalDateTime.now());
        return repository.save(memory);
    }

    public StudentCourseMemory deleteImproveSuggestion(String studentId, String courseId, String suggestion) {
        String normalized = normalize(suggestion);
        if (normalized == null) throw new IllegalArgumentException("suggestion is required");
        StudentCourseMemory memory = getOrCreateMemory(studentId, courseId);
        List<String> suggestions = memory.getImproveSuggestions() == null
                ? new ArrayList<>() : new ArrayList<>(memory.getImproveSuggestions());
        suggestions.removeIf(item -> item.equalsIgnoreCase(normalized));
        List<String> pinned = memory.getPinnedImproveSuggestions() == null
                ? new ArrayList<>() : new ArrayList<>(memory.getPinnedImproveSuggestions());
        pinned.removeIf(item -> item.equalsIgnoreCase(normalized));
        memory.setImproveSuggestions(suggestions);
        memory.setPinnedImproveSuggestions(pinned);
        memory.setUpdatedAt(LocalDateTime.now());
        return repository.save(memory);
    }

    public StudentCourseMemory recordInteraction(
            String studentId,
            String courseId,
            String classId,
            String question,
            String answer
    ) {
        StudentCourseMemory memory = getOrCreateMemory(studentId, courseId);

        if (classId != null && !classId.isBlank()) {
            memory.setClassId(classId.trim());
        }
        if (question != null && !question.isBlank()) {
            memory.setRecentQuestions(mergeRecentQuestions(memory.getRecentQuestions(), List.of(question)));
        }
        if (answer != null && !answer.isBlank() && !TextSanitizer.isSystemFailureOrEscalationAnswer(answer)) {
            List<String> answers = memory.getRecentAnswers() != null
                    ? new ArrayList<>(memory.getRecentAnswers())
                    : new ArrayList<>();
            String normalized = TextSanitizer.clean(answer);
            String shortAnswer = shortenAnswerForMemory(normalized);
            if (answers.stream().noneMatch(item -> item.equalsIgnoreCase(shortAnswer))) {
                answers.add(shortAnswer);
            }
            memory.setRecentAnswers(trimRecent(answers));
        }

        if (memory.getSummary() == null || memory.getSummary().isBlank()) {
            memory.setSummary("Student is learning course " + courseId.trim());
        }

        memory.setUpdatedAt(LocalDateTime.now());
        return repository.save(memory);
    }

    public StudentCourseMemory recordQuizResult(
            String studentId,
            String courseId,
            String classId,
            String topic,
            Double percentage
    ) {
        StudentCourseMemory memory = getOrCreateMemory(studentId, courseId);
        if (classId != null && !classId.isBlank()) {
            memory.setClassId(classId.trim());
        }

        String normalizedTopic = normalize(topic);
        if (normalizedTopic != null) {
            if (percentage != null && percentage >= 70.0) {
                List<String> learned = memory.getLearnedTopics() != null
                        ? new ArrayList<>(memory.getLearnedTopics())
                        : new ArrayList<>();
                addNormalized(learned, normalizedTopic);
                memory.setLearnedTopics(learned);
            } else {
                List<String> weak = memory.getWeakTopics() != null
                        ? new ArrayList<>(memory.getWeakTopics())
                        : new ArrayList<>();
                addNormalized(weak, normalizedTopic);
                memory.setWeakTopics(weak);
            }
        }

        memory.setSummary("Student practiced quiz for course " + courseId.trim());
        memory.setUpdatedAt(LocalDateTime.now());
        return repository.save(memory);
    }
    public UserMemory getOrCreateUserMemory(String userId) {
        return userMemoryRepository.findByUserId(userId)
                .orElseGet(() -> {
                    UserMemory memory = new UserMemory();

                    memory.setUserId(userId);
                    memory.setRecentQuestions(new ArrayList<>());
                    memory.setRecentAnswers(new ArrayList<>());
                    memory.setTags(new ArrayList<>());
                    memory.setKnownDocuments(new ArrayList<>());
                    memory.setKnownPermits(new ArrayList<>());
                    memory.setBusinessActivities(new ArrayList<>());
                    memory.setCreatedAt(LocalDateTime.now());
                    memory.setUpdatedAt(LocalDateTime.now());

                    return userMemoryRepository.save(memory);
                });
    }

    public UserMemory updateUserMemory(String userId, UpdateUserMemoryRequest request) {
        UserMemory memory = getOrCreateUserMemory(userId);

        if (request.getSummary() != null) {
            String currentSummary = memory.getSummary();
            if (currentSummary == null || currentSummary.isBlank()) {
                memory.setSummary(TextSanitizer.clean(request.getSummary()));
            } else if (!currentSummary.equalsIgnoreCase(request.getSummary())) {
                memory.setSummary(currentSummary + "\n- " + request.getSummary());
            }
        }

        if (request.getTags() != null) {
            memory.setTags(new ArrayList<>(request.getTags()));
        }
        if (request.getKnownDocuments() != null) {
            memory.setKnownDocuments(new ArrayList<>(request.getKnownDocuments()));
        }
        if (request.getKnownPermits() != null) {
            memory.setKnownPermits(new ArrayList<>(request.getKnownPermits()));
        }
        if (request.getBusinessActivities() != null) {
            memory.setBusinessActivities(new ArrayList<>(request.getBusinessActivities()));
        }
        if (request.getRecentQuestions() != null) {
            List<String> questions = memory.getRecentQuestions() != null
                    ? new ArrayList<>(memory.getRecentQuestions())
                    : new ArrayList<>();

            for (String question : request.getRecentQuestions()) {
                String normalized = normalize(question);
                if (normalized == null) {
                    continue;
                }

                boolean exists = questions.stream()
                        .anyMatch(q -> q.equalsIgnoreCase(normalized));
                if (!exists) {
                    questions.add(normalized);
                }
            }

            memory.setRecentQuestions(trimRecent(questions));
        }
        if (request.getRecentAnswers() != null) {
            List<String> answers = memory.getRecentAnswers() != null
                    ? new ArrayList<>(memory.getRecentAnswers())
                    : new ArrayList<>();

            for (String answer : request.getRecentAnswers()) {
                String normalized = TextSanitizer.clean(answer);
                if (normalized == null) {
                    continue;
                }

                String shortAnswer = shortenAnswerForMemory(normalized);
                boolean exists = answers.stream()
                        .anyMatch(a -> a.equalsIgnoreCase(shortAnswer));
                if (!exists) {
                    answers.add(shortAnswer);
                }
            }

            memory.setRecentAnswers(trimRecent(answers));
        }
        if (request.getPreferences() != null) {
            memory.setPreferences(request.getPreferences());
        }
        if (request.getPrivacyFlags() != null) {
            memory.setPrivacyFlags(request.getPrivacyFlags());
        }
        if (request.getSummary() == null
                && memory.getRecentQuestions() != null
                && !memory.getRecentQuestions().isEmpty()) {
            String lastQuestion = memory.getRecentQuestions()
                    .get(memory.getRecentQuestions().size() - 1);
            memory.setSummary(generateSummary(memory, lastQuestion));
        }

        memory.setUpdatedAt(LocalDateTime.now());
        return userMemoryRepository.save(memory);
    }

    public UserMemory saveUserMemory(UserMemory memory) {
        if (memory.getUpdatedAt() == null) {
            memory.setUpdatedAt(LocalDateTime.now());
        }
        if (memory.getCreatedAt() == null) {
            memory.setCreatedAt(LocalDateTime.now());
        }
        return userMemoryRepository.save(memory);
    }

    public CaseMemory getOrCreateCaseMemory(String userId, String caseId) {
        return caseMemoryRepository.findByUserIdAndCaseId(userId, caseId)
                .orElseGet(() -> {
                    CaseMemory memory = new CaseMemory();
                    memory.setUserId(userId);
                    memory.setCaseId(caseId);
                    memory.setCreatedAt(LocalDateTime.now());
                    memory.setUpdatedAt(LocalDateTime.now());
                    return caseMemoryRepository.save(memory);
                });
    }

    public CaseMemory updateCaseMemory(String userId, String caseId, UpdateCaseMemoryRequest request) {
        CaseMemory memory = getOrCreateCaseMemory(userId, caseId);

        if (request.getTitle() != null) {
            memory.setTitle(request.getTitle());
        }
        if (request.getSummary() != null) {
            memory.setSummary(TextSanitizer.clean(request.getSummary()));
        }
        if (request.getStatus() != null) {
            memory.setStatus(request.getStatus());
        }
        if (request.getTags() != null) {
            memory.setTags(new ArrayList<>(request.getTags()));
        }
        if (request.getRequiredDocuments() != null) {
            memory.setRequiredDocuments(new ArrayList<>(request.getRequiredDocuments()));
        }
        if (request.getKnownIssues() != null) {
            memory.setKnownIssues(new ArrayList<>(request.getKnownIssues()));
        }

        memory.setUpdatedAt(LocalDateTime.now());
        return caseMemoryRepository.save(memory);
    }

    public List<CaseMemory> listCases(String userId) {
        return caseMemoryRepository.findByUserId(userId);
    }

    private List<String> mergeRecentQuestions(List<String> existing, List<String> incoming) {
        LinkedHashSet<String> questions = new LinkedHashSet<>();

        addNormalized(questions, existing);
        addNormalized(questions, incoming);

        List<String> merged = new ArrayList<>(questions);
        if (merged.size() <= MAX_RECENT_QUESTIONS) {
            return merged;
        }

        return new ArrayList<>(merged.subList(merged.size() - MAX_RECENT_QUESTIONS, merged.size()));
    }

    private List<String> cleanList(List<String> values) {
        LinkedHashSet<String> cleaned = new LinkedHashSet<>();
        addNormalized(cleaned, values);
        return new ArrayList<>(cleaned);
    }
    private List<String> cleanImproveSuggestions(List<String> values) {
        if (values == null) {
            return new ArrayList<>();
        }
        LinkedHashSet<String> cleaned = new LinkedHashSet<>();
        for (String value : values) {
            if (TextSanitizer.isSystemFailureOrEscalationAnswer(value)) {
                continue;
            }
            String normalized = normalize(value);
            if (normalized != null && cleaned.stream().noneMatch(item -> item.equalsIgnoreCase(normalized))) {
                cleaned.add(normalized);
            }
        }
        return new ArrayList<>(cleaned);
    }

    private List<String> cleanAnswers(List<String> values) {
        if (values == null) {
            return new ArrayList<>();
        }
        List<String> answers = new ArrayList<>();
        for (String value : values) {
            if (TextSanitizer.isSystemFailureOrEscalationAnswer(value)) {
                continue;
            }
            String normalized = TextSanitizer.clean(value);
            if (normalized == null || normalized.isBlank()) {
                continue;
            }
            String shortAnswer = shortenAnswerForMemory(normalized);
            if (answers.stream().noneMatch(item -> item.equalsIgnoreCase(shortAnswer))) {
                answers.add(shortAnswer);
            }
        }
        return trimRecent(answers);
    }

    private StudentCourseMemory sanitizeExistingMemory(StudentCourseMemory memory) {
        boolean changed = false;
        List<String> cleanQuestions = cleanList(memory.getRecentQuestions());
        if (!cleanQuestions.equals(memory.getRecentQuestions())) {
            memory.setRecentQuestions(trimRecent(cleanQuestions));
            changed = true;
        }
        List<String> cleanAnswers = cleanAnswers(memory.getRecentAnswers());
        if (!cleanAnswers.equals(memory.getRecentAnswers())) {
            memory.setRecentAnswers(cleanAnswers);
            changed = true;
        }
        List<String> cleanImprove = cleanImproveSuggestions(memory.getImproveSuggestions());
        if (!cleanImprove.equals(memory.getImproveSuggestions())) {
            memory.setImproveSuggestions(cleanImprove);
            changed = true;
        }
        List<String> cleanPinned = trimPinned(cleanList(memory.getPinnedImproveSuggestions()));
        if (!cleanPinned.equals(memory.getPinnedImproveSuggestions())) {
            memory.setPinnedImproveSuggestions(cleanPinned);
            changed = true;
        }
        String cleanSummary = TextSanitizer.clean(memory.getSummary());
        if (cleanSummary != null && !cleanSummary.equals(memory.getSummary())) {
            memory.setSummary(cleanSummary);
            changed = true;
        }
        if (changed) {
            memory.setUpdatedAt(LocalDateTime.now());
            return repository.save(memory);
        }
        return memory;
    }

    private void addNormalized(List<String> target, String value) {
        String normalized = normalize(value);
        if (normalized != null && target.stream().noneMatch(item -> item.equalsIgnoreCase(normalized))) {
            target.add(normalized);
        }
    }

    private void addNormalized(LinkedHashSet<String> target, List<String> values) {
        if (values == null) {
            return;
        }

        for (String value : values) {
            String normalized = normalize(value);
            if (normalized != null && target.stream().noneMatch(item -> item.equalsIgnoreCase(normalized))) {
                target.add(normalized);
            }
        }
    }

    private String normalize(String value) {
        String cleaned = TextSanitizer.clean(value);
        return cleaned != null && !cleaned.isBlank() ? cleaned : null;
    }
    private String shortenAnswerForMemory(String answer) {
        String cleaned = TextSanitizer.clean(answer);
        if (cleaned == null) {
            return null;
        }
        int maxLength = 800;
        if (cleaned.length() <= maxLength) {
            if (cleaned.length() >= 450 && !cleaned.matches("(?s).*[.!?。…)]\\s*$")) {
                return cleaned + "...";
            }
            return cleaned;
        }
        int cutAt = cleaned.lastIndexOf(' ', maxLength);
        if (cutAt < 300) {
            cutAt = maxLength;
        }
        return cleaned.substring(0, cutAt).trim() + "...";
    }

    private List<String> trimRecent(List<String> items) {
        if (items == null) {
            return new ArrayList<>();
        }
        if (items.size() <= MAX_RECENT_ITEMS) {
            return new ArrayList<>(items);
        }
        return new ArrayList<>(items.subList(items.size() - MAX_RECENT_ITEMS, items.size()));
    }

    private List<String> trimPinned(List<String> items) {
        if (items == null) {
            return new ArrayList<>();
        }
        if (items.size() <= MAX_PINNED_SUGGESTIONS) {
            return new ArrayList<>(items);
        }
        return new ArrayList<>(items.subList(items.size() - MAX_PINNED_SUGGESTIONS, items.size()));
    }

    private String generateSummary(UserMemory memory, String latestQuestion) {
        if (latestQuestion == null) {
            return memory.getSummary();
        }

        String q = latestQuestion.toLowerCase();
        if (q.contains("jpa")) {
            return "Student is learning JPA and persistence concepts";
        }
        if (q.contains("spring security") || q.contains("403")) {
            return "Student is learning Spring Security and authorization concepts";
        }
        if (q.contains("mvc")) {
            return "Student is learning MVC architecture";
        }
        return "Student is learning course concepts with the AI Tutor Platform";
    }

    private void validateScope(String studentId, String courseId) {
        if (studentId == null || studentId.isBlank()) {
            throw new IllegalArgumentException("studentId is required");
        }
        if (courseId == null || courseId.isBlank()) {
            throw new IllegalArgumentException("courseId is required");
        }
    }
}
