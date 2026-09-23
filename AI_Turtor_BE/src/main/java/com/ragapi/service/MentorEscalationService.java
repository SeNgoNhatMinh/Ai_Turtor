package com.ragapi.service;

import com.ragapi.dto.MentorEscalationOfferResponse;
import com.ragapi.dto.MentorSelectionResponse;
import com.ragapi.dto.MentorSuggestionDTO;
import com.ragapi.entity.ChatRoom;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.ChatRoomRepository;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@AllArgsConstructor
public class MentorEscalationService {

    private static final String ROUTE_CLASS_TEACHER = "CLASS_TEACHER";
    private static final String ROUTE_MENTOR_MATCHING = "MENTOR_MATCHING";

    private final QuestionEscalationRepository questionEscalationRepository;
    private final MentorRepository mentorRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final MentorMatchingService matchingService;
    private final AcademicRoutingService academicRoutingService;
    private final ClassSectionRepository classSectionRepository;
    private final RealtimeEventService realtimeEventService;

    public QuestionEscalation createQuestionEscalation(
            String userId,
            String userEmail,
            String userName,
            String question,
            String aiResponse
    ) {
        return createQuestionEscalation(userId, userEmail, userName, question, aiResponse, null, null, null);
    }

    public QuestionEscalation createQuestionEscalation(
            String userId,
            String userEmail,
            String userName,
            String question,
            String aiResponse,
            String courseId,
            String classId
    ) {
        return createQuestionEscalation(userId, userEmail, userName, question, aiResponse, courseId, classId, null);
    }

    public QuestionEscalation createQuestionEscalation(
            String userId,
            String userEmail,
            String userName,
            String question,
            String aiResponse,
            String courseId,
            String classId,
            String conversationId
    ) {
        LocalDateTime now = LocalDateTime.now();
        QuestionEscalation request = QuestionEscalation.builder()
                .id(UUID.randomUUID().toString())
                .userId(trimToNull(userId))
                .userEmail(trimToNull(userEmail))
                .userName(trimToNull(userName))
                .originalQuestion(trimToNull(question))
                .aiResponse(aiResponse)
                .courseId(trimToNull(courseId))
                .classId(trimToNull(classId))
                .conversationId(trimToNull(conversationId))
                .status("PENDING_OFFER")
                .questionAskedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();

        return questionEscalationRepository.save(request);
    }

    public MentorEscalationOfferResponse offerMentorHelp(String questionEscalationId, String userId) {
        Optional<QuestionEscalation> opt = questionEscalationRepository.findById(questionEscalationId);
        if (opt.isEmpty()) {
            log.error("Question escalation not found: {}", questionEscalationId);
            return null;
        }

        QuestionEscalation request = opt.get();
        requireStudentOwner(request, userId, "request mentor suggestions");
        if ("IN_CHAT".equalsIgnoreCase(request.getStatus())
                && request.getChatRoomId() != null
                && !request.getChatRoomId().isBlank()) {
            return buildExistingChatOffer(request);
        }

        AcademicRoutingService.EscalationRoute route = academicRoutingService.resolveRoute(
                request.getUserId(),
                request.getCourseId(),
                request.getClassId()
        );

        List<MentorSuggestionDTO> suggestions;
        String message;
        String routeName;

        if (route.routeToClassTeacher()) {
            routeName = ROUTE_CLASS_TEACHER;
            suggestions = buildCourseTeacherSuggestions(request.getCourseId(), route.classSection());
            message = suggestions.isEmpty()
                    ? "Môn học đang hoạt động nhưng chưa tìm thấy hồ sơ giáo viên được kích hoạt."
                    : "Giáo viên của lớp bạn được chọn mặc định. Bạn vẫn có thể chọn giáo viên khác đang dạy môn này, kể cả khi họ đang offline.";
        } else {
            routeName = ROUTE_MENTOR_MATCHING;
            suggestions = findMentorSuggestions(request);
            message = "This course is completed or has no active class teacher route. You can select a matched mentor.";
        }

        request.setStatus("OFFERED");
        request.setEscalationRoute(routeName);
        request.setRouteReason(route.reason());
        request.setMentorHelpOfferedAt(LocalDateTime.now());
        request.setUpdatedAt(LocalDateTime.now());
        questionEscalationRepository.save(request);

        log.info(
                "Escalation offer prepared: request={}, route={}, suggestions={}",
                questionEscalationId,
                routeName,
                suggestions.size()
        );

        return MentorEscalationOfferResponse.builder()
                .questionEscalationId(questionEscalationId)
                .shouldOfferMentorHelp(!suggestions.isEmpty())
                .suggestedMentors(suggestions)
                .message(message)
                .escalationRoute(routeName)
                .routeReason(route.reason())
                .build();
    }

    public MentorSelectionResponse selectMentor(
            String questionEscalationId,
            String userId,
            String selectedMentorId
    ) {
        QuestionEscalation request = questionEscalationRepository.findById(questionEscalationId)
                .orElseThrow(() -> new RuntimeException("Question escalation not found"));

        requireStudentOwner(request, userId, "select a mentor");

        if ("IN_CHAT".equalsIgnoreCase(request.getStatus())
                && request.getChatRoomId() != null
                && !request.getChatRoomId().isBlank()) {
            Mentor mentor = mentorRepository.findById(request.getAssignedMentorId())
                    .orElse(null);
            return MentorSelectionResponse.builder()
                    .chatRoomId(request.getChatRoomId())
                    .mentorName(mentor != null ? mentor.getMentorName() : request.getAssignedMentorName())
                    .mentorEmail(mentor != null ? mentor.getEmail() : request.getAssignedMentorEmail())
                    .message("Resuming existing chat room")
                    .build();
        }

        validateSelectionRoute(request, selectedMentorId);

        Mentor mentor = mentorRepository.findById(selectedMentorId)
                .orElseThrow(() -> new RuntimeException("Mentor not found"));

        ChatRoom chatRoom = ChatRoom.builder()
                .id(UUID.randomUUID().toString())
                .userId(request.getUserId())
                .userName(request.getUserName())
                .userEmail(request.getUserEmail())
                .mentorId(mentor.getId())
                .mentorName(mentor.getMentorName())
                .mentorEmail(mentor.getEmail())
                .questionEscalationId(questionEscalationId)
                .originalQuestion(request.getOriginalQuestion())
                .aiResponse(request.getAiResponse())
                .status("ACTIVE")
                .messageCount(0)
                .userMessageCount(0)
                .mentorMessageCount(0)
                .isUnread(true)
                .createdAt(LocalDateTime.now())
                .topic(extractTopic(request.getOriginalQuestion()))
                .build();

        chatRoom = chatRoomRepository.save(chatRoom);

        request.setStatus("IN_CHAT");
        request.setAssignedMentorId(mentor.getId());
        request.setAssignedMentorName(mentor.getMentorName());
        request.setAssignedMentorEmail(mentor.getEmail());
        request.setChatRoomId(chatRoom.getId());
        request.setMentorAssignedAt(LocalDateTime.now());
        request.setUpdatedAt(LocalDateTime.now());
        questionEscalationRepository.save(request);

        mentor.setCurrentActiveChatSessions(
                (mentor.getCurrentActiveChatSessions() != null ? mentor.getCurrentActiveChatSessions() : 0) + 1
        );
        mentor.setUpdatedAt(LocalDateTime.now());
        mentorRepository.save(mentor);

        log.info("Chat room created: {} between user {} and mentor {}", chatRoom.getId(), userId, selectedMentorId);
        boolean mentorOnline = realtimeEventService.isUserOnline(mentor.getId());

        return MentorSelectionResponse.builder()
                .chatRoomId(chatRoom.getId())
                .mentorName(mentor.getMentorName())
                .mentorEmail(mentor.getEmail())
                .message(mentorOnline
                        ? "You are now connected with " + mentor.getMentorName()
                        : "Your request was sent to " + mentor.getMentorName() + ", who can reply when back online")
                .build();
    }

    public void cancelMentorHelpOffer(String questionEscalationId, String userId, String reason) {
        questionEscalationRepository.findById(questionEscalationId).ifPresent(request -> {
            requireStudentOwner(request, userId, "cancel it");
            request.setStatus("CANCELLED");
            request.setCancelReason(reason);
            request.setUpdatedAt(LocalDateTime.now());
            questionEscalationRepository.save(request);
            log.info("Mentor help offer cancelled: {} - reason={}", questionEscalationId, reason);
        });
    }

    public List<QuestionEscalation> getUserMentorEscalationHistory(String userId) {
        return questionEscalationRepository.findByUserId(userId);
    }

    public List<QuestionEscalation> getPendingQuestionEscalations() {
        return questionEscalationRepository.findByStatus("PENDING_OFFER");
    }

    private MentorEscalationOfferResponse buildExistingChatOffer(QuestionEscalation request) {
        Mentor mentor = mentorRepository.findById(request.getAssignedMentorId()).orElse(null);
        List<MentorSuggestionDTO> suggestions = mentor == null
                ? Collections.emptyList()
                : List.of(MentorSuggestionDTO.builder()
                        .id(mentor.getId())
                        .mentorName(mentor.getMentorName())
                        .avatarUrl(mentor.getAvatarUrl())
                        .averageRating(mentor.getAverageRating())
                        .completedMentorSessions(mentor.getCompletedMentorSessions())
                        .description(mentor.getDescription())
                        .matchScore(100.0)
                        .matchReason("Active chat already exists for this escalation")
                        .responseTimeMinutes(mentor.getResponseTimeMinutes())
                        .specializations(mentor.getSpecializations())
                        .online(realtimeEventService.isUserOnline(mentor.getId()))
                        .build());

        return MentorEscalationOfferResponse.builder()
                .questionEscalationId(request.getId())
                .shouldOfferMentorHelp(true)
                .suggestedMentors(suggestions)
                .message("You already have an active chat room for this escalation.")
                .escalationRoute(request.getEscalationRoute())
                .routeReason(request.getRouteReason())
                .build();
    }

    private void requireStudentOwner(QuestionEscalation escalation, String userId, String action) {
        if (escalation == null || escalation.getUserId() == null || !escalation.getUserId().equals(userId)) {
            throw new SecurityException("Only the student who created this escalation can " + action);
        }
    }

    private List<MentorSuggestionDTO> buildClassTeacherSuggestion(ClassSection classSection) {
        if (classSection == null || isBlank(classSection.getTeacherId())) {
            return Collections.emptyList();
        }

        return resolveClassTeacher(classSection)
                .map(teacher -> List.of(mapTeacherToSuggestion(teacher, classSection)))
                .orElseGet(Collections::emptyList);
    }

    private List<MentorSuggestionDTO> buildCourseTeacherSuggestions(String courseId, ClassSection defaultClassSection) {
        Map<String, MentorSuggestionDTO> suggestions = new LinkedHashMap<>();

        for (MentorSuggestionDTO suggestion : buildClassTeacherSuggestion(defaultClassSection)) {
            suggestions.put(suggestion.getId(), suggestion);
        }

        if (!isBlank(courseId)) {
            for (ClassSection section : classSectionRepository.findByCourseId(courseId.trim())) {
                resolveClassTeacher(section)
                        .map(teacher -> mapTeacherToSuggestion(teacher, section, isSameClass(section, defaultClassSection)))
                        .ifPresent(suggestion -> suggestions.putIfAbsent(suggestion.getId(), suggestion));
            }
        }

        return List.copyOf(suggestions.values());
    }

    private Optional<Mentor> resolveClassTeacher(ClassSection classSection) {
        if (classSection == null || isBlank(classSection.getTeacherId())) {
            return Optional.empty();
        }
        String teacherKey = classSection.getTeacherId().trim();
        Optional<Mentor> mentor = mentorRepository.findById(teacherKey);
        if (mentor.isEmpty()) {
            mentor = mentorRepository.findByMentorCode(teacherKey);
        }
        return mentor.filter(m -> Boolean.TRUE.equals(m.getIsActive()));
    }

    private MentorSuggestionDTO mapTeacherToSuggestion(Mentor teacher, ClassSection classSection) {
        return mapTeacherToSuggestion(teacher, classSection, true);
    }

    private MentorSuggestionDTO mapTeacherToSuggestion(Mentor teacher, ClassSection classSection, boolean defaultTeacher) {
        String classLabel = classSection == null || isBlank(classSection.getClassId())
                ? "môn học này"
                : "lớp " + classSection.getClassId();
        String courseLabel = classSection == null || isBlank(classSection.getCourseId())
                ? "môn học"
                : "môn " + classSection.getCourseId();
        return MentorSuggestionDTO.builder()
                .id(teacher.getId())
                .mentorName(teacher.getMentorName())
                .avatarUrl(teacher.getAvatarUrl())
                .averageRating(teacher.getAverageRating())
                .completedMentorSessions(teacher.getCompletedMentorSessions())
                .description(teacher.getDescription())
                .matchScore(defaultTeacher ? 100.0 : 85.0)
                .matchReason(defaultTeacher
                        ? "Mặc định: giáo viên phụ trách " + classLabel + " trong " + courseLabel
                        : "Giáo viên phụ trách " + classLabel + " trong " + courseLabel)
                .responseTimeMinutes(teacher.getResponseTimeMinutes())
                .specializations(teacher.getSpecializations())
                .online(realtimeEventService.isUserOnline(teacher.getId()))
                .build();
    }

    private List<MentorSuggestionDTO> findMentorSuggestions(QuestionEscalation request) {
        List<MentorSuggestionDTO> suggestions = matchingService.findMatchingMentors(request.getOriginalQuestion(), 5);
        if (suggestions != null && !suggestions.isEmpty()) {
            return suggestions;
        }

        log.warn("No matching mentors for request {}. Falling back to active mentors.", request.getId());
        return mentorRepository.findByIsActiveTrue().stream()
                .map(mentor -> MentorSuggestionDTO.builder()
                        .id(mentor.getId())
                        .mentorName(mentor.getMentorName())
                        .avatarUrl(mentor.getAvatarUrl())
                        .averageRating(mentor.getAverageRating())
                        .completedMentorSessions(mentor.getCompletedMentorSessions())
                        .description(mentor.getDescription())
                        .matchScore(0.0)
                        .matchReason("Fallback: active mentor")
                        .responseTimeMinutes(mentor.getResponseTimeMinutes())
                        .specializations(mentor.getSpecializations())
                        .online(realtimeEventService.isUserOnline(mentor.getId()))
                        .build())
                .collect(Collectors.toList());
    }

    private void validateSelectionRoute(QuestionEscalation request, String selectedMentorId) {
        if (!ROUTE_CLASS_TEACHER.equalsIgnoreCase(request.getEscalationRoute())) {
            return;
        }

        AcademicRoutingService.EscalationRoute route = academicRoutingService.resolveRoute(
                request.getUserId(),
                request.getCourseId(),
                request.getClassId()
        );

        if (isBlank(request.getCourseId())) {
            throw new RuntimeException("Active course escalation is missing courseId");
        }

        boolean selectedCourseTeacher = classSectionRepository.findByCourseId(request.getCourseId().trim()).stream()
                .map(this::resolveClassTeacher)
                .flatMap(Optional::stream)
                .anyMatch(teacher -> teacher.getId().equals(selectedMentorId));

        if (!selectedCourseTeacher) {
            throw new RuntimeException("Active course escalation must be assigned to a teacher of this course");
        }
    }

    private boolean isSameClass(ClassSection left, ClassSection right) {
        if (left == null || right == null) {
            return false;
        }
        return equalsIgnoreCase(left.getCourseId(), right.getCourseId())
                && equalsIgnoreCase(left.getClassId(), right.getClassId());
    }

    private boolean equalsIgnoreCase(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        return left.trim().equalsIgnoreCase(right.trim());
    }

    private String extractTopic(String question) {
        if (question == null || question.isBlank()) {
            return "General tutoring";
        }

        String normalized = question.toLowerCase();
        if (normalized.contains("java")) return "Java programming";
        if (normalized.contains("spring")) return "Spring Boot";
        if (normalized.contains("jpa")) return "JPA and persistence";
        if (normalized.contains("security")) return "Spring Security";
        if (normalized.contains("database") || normalized.contains("sql")) return "Database";

        return "Course tutoring";
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
