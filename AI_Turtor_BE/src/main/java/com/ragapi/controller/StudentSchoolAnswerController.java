package com.ragapi.controller;

import com.ragapi.dto.StudentLlmKeyRequest;
import com.ragapi.dto.StudentSchoolAnswerRequest;
import com.ragapi.dto.StudentSchoolExcerpt;
import com.ragapi.dto.SuggestionItem;
import com.ragapi.service.LearningPathGroundingService;
import com.ragapi.service.StudentLlmCredentialService;
import com.ragapi.service.PedagogicalDirectiveService;
import com.ragapi.service.StudentDailyQuestionQuotaService;
import com.ragapi.service.StudentOwnedLlmService;
import com.ragapi.service.StudentSchoolMaterialContextService;
import com.ragapi.util.StudentChatIntentDetector;
import com.ragapi.util.StudentFacingMessages;
import com.ragapi.util.ValidationUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * After the platform question quota is used up, answer from school RAG
 * with the student's own LLM key. Stored keys stay encrypted and are not returned.
 */
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class StudentSchoolAnswerController {

    static final String STUDENT_LLM_KEY_HEADER = "X-Student-Llm-Key";

    private final StudentSchoolMaterialContextService schoolMaterialContextService;
    private final StudentOwnedLlmService studentOwnedLlmService;
    private final StudentDailyQuestionQuotaService questionQuotaService;
    private final PedagogicalDirectiveService pedagogicalDirectiveService;
    private final LearningPathGroundingService learningPathGroundingService;
    private final StudentLlmCredentialService studentLlmCredentialService;

    @GetMapping("/student-llm")
    public ResponseEntity<?> studentLlmStatus(Authentication authentication) {
        if (!isStudent(authentication)) return forbiddenStudent();
        return ResponseEntity.ok(studentLlmCredentialService.status(authentication.getName()));
    }

    @PutMapping("/student-llm")
    public ResponseEntity<?> saveStudentLlm(@RequestBody StudentLlmKeyRequest request, Authentication authentication) {
        if (!isStudent(authentication)) return forbiddenStudent();
        try {
            return ResponseEntity.ok(studentLlmCredentialService.save(
                    authentication.getName(),
                    request == null ? null : request.getProvider(),
                    request == null ? null : request.getModel(),
                    request == null ? null : request.getApiKey()
            ));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
    }

    @DeleteMapping("/student-llm")
    public ResponseEntity<?> deleteStudentLlm(Authentication authentication) {
        if (!isStudent(authentication)) return forbiddenStudent();
        studentLlmCredentialService.delete(authentication.getName());
        return ResponseEntity.ok(Map.of("configured", false));
    }

    @GetMapping("/student-llm/usage")
    public ResponseEntity<?> studentLlmUsage(Authentication authentication) {
        if (!isStudent(authentication)) return forbiddenStudent();
        return ResponseEntity.ok(Map.of("usage", studentLlmCredentialService.usage(authentication.getName())));
    }

    @PostMapping("/school-answer")
    public ResponseEntity<?> answerWithSchoolMaterial(
            @RequestBody StudentSchoolAnswerRequest request,
            @RequestHeader(value = STUDENT_LLM_KEY_HEADER, required = false) String studentLlmKey,
            Authentication authentication
    ) {
        if (!isStudent(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "code", "SCHOOL_MATERIAL_FORBIDDEN",
                    "error", "Only an enrolled student can use school materials with a personal LLM"
            ));
        }
        try {
            String courseId = ValidationUtils.requireText(request == null ? null : request.getCourseId(), "courseId");
            String question = ValidationUtils.requireMaxLength(
                    request.getQuestion(),
                    "question",
                    ValidationUtils.STUDENT_QUESTION_MAX_LENGTH
            );
            String studentId = authentication.getName();
            if (questionQuotaService.currentUsage(studentId, courseId).remaining() > 0) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "code", "PLATFORM_QUOTA_REMAINING",
                        "error", "Platform tutor quota is still available"
                ));
            }
            schoolMaterialContextService.requireOpenEnrollment(studentId, courseId);
            if (StudentChatIntentDetector.isTopicStudyStart(question)
                    || StudentChatIntentDetector.isTopiclessStudyRequest(question)) {
                List<SuggestionItem> lessons = learningPathGroundingService.ground(courseId, question, List.of());
                if (lessons.isEmpty()) {
                    return ResponseEntity.ok(Map.of(
                            "answer", StudentFacingMessages.noMatchingStudyUnit(),
                            "grounded", false,
                            "source", "SCHOOL_MATERIAL",
                            "nextImproveSuggestions", List.of()
                    ));
                }
                Map<String, Object> path = new LinkedHashMap<>();
                path.put("answer", learningPathGroundingService.pathAnswer(lessons));
                path.put("grounded", true);
                path.put("source", "SCHOOL_MATERIAL");
                path.put("nextImproveSuggestions", lessons);
                return ResponseEntity.ok(path);
            }
            List<StudentSchoolExcerpt> excerpts = schoolMaterialContextService.excerptsFor(
                    studentId,
                    courseId,
                    request.getClassId(),
                    question
            );
            if (excerpts.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "answer", "Tài liệu nhà trường của môn này chưa có đoạn phù hợp với câu hỏi, nên mình không dùng API bên ngoài để tự trả lời.",
                        "grounded", false,
                        "source", "SCHOOL_MATERIAL"
                ));
            }
            String supportLevel = pedagogicalDirectiveService.resolveSupportLevel(
                    studentId,
                    courseId,
                    request.getClassId()
            );
            String answer = studentOwnedLlmService.answer(
                    request.getProvider(),
                    request.getModel(),
                    studentLlmCredentialService.resolveKey(studentId, studentLlmKey),
                    question,
                    supportLevel,
                    excerpts
            );
            studentLlmCredentialService.recordUsage(studentId, request.getProvider(), request.getModel(), "COMPLETED");
            return ResponseEntity.ok(Map.of(
                    "answer", answer,
                    "grounded", true,
                    "source", "SCHOOL_MATERIAL"
            ));
        } catch (StudentSchoolMaterialContextService.SchoolMaterialAccessException error) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "code", "SCHOOL_MATERIAL_FORBIDDEN",
                    "error", "Student is not enrolled in this course"
            ));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        } catch (IllegalStateException error) {
            if (authentication != null && request != null) {
                studentLlmCredentialService.recordUsage(
                        authentication.getName(), request.getProvider(), request.getModel(), "FAILED");
            }
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                    "error", "API LLM của bạn không trả lời được lúc này. Kiểm tra key, model, rồi thử lại."
            ));
        }
    }

    private ResponseEntity<Map<String, String>> forbiddenStudent() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                "code", "SCHOOL_MATERIAL_FORBIDDEN",
                "error", "Only an enrolled student can manage a personal LLM key"
        ));
    }

    private boolean isStudent(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_STUDENT".equals(authority.getAuthority()));
    }
}
