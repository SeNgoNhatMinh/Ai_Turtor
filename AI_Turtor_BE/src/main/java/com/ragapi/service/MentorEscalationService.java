package com.ragapi.service;

import com.ragapi.dto.MentorEscalationOfferResponse;
import com.ragapi.dto.MentorSelectionResponse;
import com.ragapi.dto.MentorSuggestionDTO;
import com.ragapi.entity.ChatRoom;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.Mentor;
import com.ragapi.entity.QuestionEscalation;
import com.ragapi.repository.ChatRoomRepository;
import com.ragapi.repository.MentorRepository;
import com.ragapi.repository.QuestionEscalationRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
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

    public MentorEscalationOfferResponse offerMentorHelp(String questionEscalationId) {
        Optional<QuestionEscalation> opt = questionEscalationRepository.findById(questionEscalationId);
        if (opt.isEmpty()) {
            log.error("Question escalation not found: {}", questionEscalationId);
            return null;
        }

        QuestionEscalation request = opt.get();
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
            suggestions = buildClassTeacherSuggestion(route.classSection());
            message = suggestions.isEmpty()
                    ? "Class teacher is configured for this course/class, but the teacher profile was not found."
                    : "This course is active. Your question will be routed to the teacher of your class.";
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

        return MentorSelectionResponse.builder()
                .chatRoomId(chatRoom.getId())
                .mentorName(mentor.getMentorName())
                .mentorEmail(mentor.getEmail())
                .message("You are now connected with " + mentor.getMentorName())
                .build();
    }

    public void cancelMentorHelpOffer(String questionEscalationId, String userId, String reason) {
        questionEscalationRepository.findById(questionEscalationId).ifPresent(request -> {
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

    private List<MentorSuggestionDTO> buildClassTeacherSuggestion(ClassSection classSection) {
        if (classSection == null || isBlank(classSection.getTeacherId())) {
            return Collections.emptyList();
        }

        return resolveClassTeacher(classSection)
                .map(teacher -> List.of(mapTeacherToSuggestion(teacher, classSection)))
                .orElseGet(Collections::emptyList);
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
        return MentorSuggestionDTO.builder()
                .id(teacher.getId())
                .mentorName(teacher.getMentorName())
                .avatarUrl(teacher.getAvatarUrl())
                .averageRating(teacher.getAverageRating())
                .completedMentorSessions(teacher.getCompletedMentorSessions())
                .description(teacher.getDescription())
                .matchScore(100.0)
                .matchReason("Teacher for class " + classSection.getClassId() + " in course " + classSection.getCourseId())
                .responseTimeMinutes(teacher.getResponseTimeMinutes())
                .specializations(teacher.getSpecializations())
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

        ClassSection classSection = route.classSection();
        Mentor teacher = resolveClassTeacher(classSection)
                .orElseThrow(() -> new RuntimeException("Class teacher route is configured but no teacher is available"));

        if (!teacher.getId().equals(selectedMentorId)) {
            throw new RuntimeException("Active course escalation must be assigned to the class teacher");
        }
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


