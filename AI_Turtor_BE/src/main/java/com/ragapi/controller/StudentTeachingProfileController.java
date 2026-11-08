package com.ragapi.controller;

import com.ragapi.dto.StudentTeachingProfileRequest;
import com.ragapi.dto.TeachingBehaviorRequest;
import com.ragapi.entity.TeachingBehavior;
import com.ragapi.service.AccessGuardService;
import com.ragapi.service.PedagogicalDirectiveService;
import com.ragapi.service.behavior.BehaviorAccessDeniedException;
import com.ragapi.service.behavior.BehaviorActor;
import com.ragapi.service.behavior.StudentTeachingProfileService;
import com.ragapi.service.behavior.TeachingBehaviorRetrievalService;
import com.ragapi.service.behavior.TeachingBehaviorRetrievalService.TeachingGuidance;
import com.ragapi.service.behavior.TeachingBehaviorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

import static com.ragapi.controller.TeachingBehaviorController.actor;
import static com.ragapi.controller.TeachingBehaviorController.handle;

/** A teacher's view of one student's teaching profile and personal RAG behavior set. */
@RestController
@RequestMapping("/api/teacher/students/{studentId}/teaching")
@RequiredArgsConstructor
public class StudentTeachingProfileController {
    private final StudentTeachingProfileService profileService;
    private final TeachingBehaviorService behaviorService;
    private final TeachingBehaviorRetrievalService retrievalService;
    private final PedagogicalDirectiveService directiveService;
    private final AccessGuardService accessGuard;

    @GetMapping("/profile")
    public ResponseEntity<?> profile(@PathVariable String studentId, @RequestParam String courseId,
                                     @RequestParam String classId, Authentication authentication) {
        return guarded(authentication, studentId, courseId, classId,
                () -> profileService.getOrEmpty(studentId, courseId, classId));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@PathVariable String studentId, @RequestParam String courseId,
                                           @RequestParam String classId,
                                           @RequestBody StudentTeachingProfileRequest request,
                                           Authentication authentication) {
        return guarded(authentication, studentId, courseId, classId,
                () -> profileService.update(studentId, courseId, classId, request, authentication.getName()));
    }

    @GetMapping("/behaviors")
    public ResponseEntity<?> behaviors(@PathVariable String studentId, @RequestParam String courseId,
                                       @RequestParam String classId, Authentication authentication) {
        return guarded(authentication, studentId, courseId, classId,
                () -> profileService.studentBehaviors(studentId, courseId, classId));
    }

    @PostMapping("/behaviors")
    public ResponseEntity<?> createPersonal(@PathVariable String studentId, @RequestParam String courseId,
                                            @RequestParam String classId,
                                            @RequestBody TeachingBehaviorRequest request,
                                            Authentication authentication) {
        return guarded(authentication, studentId, courseId, classId, () -> {
            TeachingBehaviorRequest personal = request == null ? new TeachingBehaviorRequest() : request;
            personal.setScope(TeachingBehavior.SCOPE_STUDENT);
            personal.setStudentId(studentId);
            personal.setCourseId(courseId);
            personal.setClassId(classId);
            return behaviorService.create(personal, actor(authentication));
        });
    }

    /** Teacher CRUD for one student's own RAG behaviors (AI-created or teacher-written). */
    @PutMapping("/behaviors/{behaviorId}")
    public ResponseEntity<?> updatePersonal(@PathVariable String studentId, @PathVariable String behaviorId,
                                            @RequestParam String courseId, @RequestParam String classId,
                                            @RequestBody TeachingBehaviorRequest request,
                                            Authentication authentication) {
        return guarded(authentication, studentId, courseId, classId, () -> {
            BehaviorActor actor = actor(authentication);
            TeachingBehavior existing = behaviorService.get(behaviorId, actor);
            requireOwnedByStudent(existing, studentId, courseId);
            return behaviorService.update(behaviorId, request, actor);
        });
    }

    @PostMapping("/behaviors/{behaviorId}/status")
    public ResponseEntity<?> setPersonalStatus(@PathVariable String studentId, @PathVariable String behaviorId,
                                               @RequestParam String courseId, @RequestParam String classId,
                                               @RequestBody(required = false) Map<String, String> body,
                                               Authentication authentication) {
        return guarded(authentication, studentId, courseId, classId, () -> {
            BehaviorActor actor = actor(authentication);
            TeachingBehavior existing = behaviorService.get(behaviorId, actor);
            requireOwnedByStudent(existing, studentId, courseId);
            return behaviorService.setStatus(behaviorId, body == null ? null : body.get("status"), actor);
        });
    }

    @PostMapping("/behaviors/{behaviorId}/{action:pin|unpin|block|unblock}")
    public ResponseEntity<?> changeMembership(@PathVariable String studentId, @PathVariable String behaviorId,
                                              @PathVariable String action, @RequestParam String courseId,
                                              @RequestParam String classId, Authentication authentication) {
        return guarded(authentication, studentId, courseId, classId, () -> {
            String teacherId = authentication.getName();
            return switch (action) {
                case "pin" -> profileService.pin(studentId, courseId, classId, behaviorId, teacherId);
                case "unpin" -> profileService.unpin(studentId, courseId, classId, behaviorId, teacherId);
                case "block" -> profileService.block(studentId, courseId, classId, behaviorId, teacherId);
                case "unblock" -> profileService.unblock(studentId, courseId, classId, behaviorId, teacherId);
                default -> throw new IllegalArgumentException("Thao tác không hợp lệ");
            };
        });
    }

    private static void requireOwnedByStudent(TeachingBehavior behavior, String studentId, String courseId) {
        if (!TeachingBehavior.SCOPE_STUDENT.equals(behavior.getScope())
                || !studentId.equals(behavior.getStudentId())
                || !courseId.equals(behavior.getCourseId())) {
            throw new IllegalArgumentException("Hành vi không thuộc bộ RAG riêng của sinh viên này trong môn này");
        }
    }

    /** What the tutor would apply if this student asked {@code question} now (usage is not recorded). */
    @GetMapping("/preview")
    public ResponseEntity<?> preview(@PathVariable String studentId, @RequestParam String courseId,
                                     @RequestParam String classId,
                                     @RequestParam(required = false) String question,
                                     @RequestParam(required = false) String domain,
                                     Authentication authentication) {
        return guarded(authentication, studentId, courseId, classId, () -> {
            String supportLevel = directiveService.resolveSupportLevel(studentId, courseId, classId);
            TeachingGuidance guidance = retrievalService.retrieve(
                    studentId, courseId, classId, supportLevel, question, domain, false);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("supportLevel", supportLevel);
            result.put("behaviors", guidance.behaviors().stream().map(item -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("behavior", item.behavior());
                row.put("score", Math.round(item.score() * 100) / 100.0);
                row.put("reason", item.reason());
                return row;
            }).toList());
            result.put("promptBlock", guidance.promptBlock());
            return result;
        });
    }

    private ResponseEntity<?> guarded(Authentication authentication, String studentId, String courseId,
                                      String classId, Supplier<?> action) {
        return handle(() -> {
            BehaviorActor actor = actor(authentication);
            try {
                accessGuard.allowTeacherForStudentTranscript(actor.id(), actor.role(), studentId, courseId, classId);
            } catch (IllegalArgumentException denied) {
                throw new BehaviorAccessDeniedException(denied.getMessage());
            }
            return action.get();
        });
    }
}
