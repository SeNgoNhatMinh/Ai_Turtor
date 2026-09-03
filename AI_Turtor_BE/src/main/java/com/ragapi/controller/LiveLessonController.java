package com.ragapi.controller;

import com.ragapi.dto.CreateLiveLessonRequest;
import com.ragapi.dto.LiveLessonAiAskRequest;
import com.ragapi.dto.LiveLessonChatMessageRequest;
import com.ragapi.dto.UpdateLiveLessonRequest;
import com.ragapi.service.LiveLessonService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/live-lessons")
@RequiredArgsConstructor
@Tag(name = "Live Lessons", description = "Scheduled class watch-together sessions with teacher chat and private AI questions")
public class LiveLessonController {

    private final LiveLessonService liveLessonService;

    @PostMapping
    @Operation(summary = "Teacher schedules a YouTube live lesson for an assigned class")
    public ResponseEntity<?> create(
            @RequestBody CreateLiveLessonRequest request,
            @RequestParam(required = false) String teacherName,
            Authentication auth
    ) {
        try {
            requireTeacher(auth);
            return ResponseEntity.ok(liveLessonService.create(request, userId(auth), teacherName));
        } catch (Exception error) {
            return errorResponse("creating live lesson", error);
        }
    }

    @GetMapping
    @Operation(summary = "List live lessons for the current student or teacher")
    public ResponseEntity<?> list(
            @RequestParam(required = false) String courseId,
            @RequestParam(required = false) String classId,
            Authentication auth
    ) {
        try {
            return ResponseEntity.ok(liveLessonService.listMine(userId(auth), role(auth), courseId, classId));
        } catch (Exception error) {
            return errorResponse("listing live lessons", error);
        }
    }

    @GetMapping("/{lessonId}")
    public ResponseEntity<?> get(@PathVariable String lessonId, Authentication auth) {
        try {
            return ResponseEntity.ok(liveLessonService.get(lessonId, userId(auth), role(auth)));
        } catch (Exception error) {
            return errorResponse("loading live lesson", error);
        }
    }

    @PutMapping("/{lessonId}")
    @Operation(summary = "Teacher updates a scheduled live lesson")
    public ResponseEntity<?> update(
            @PathVariable String lessonId,
            @RequestBody UpdateLiveLessonRequest request,
            Authentication auth
    ) {
        try {
            requireTeacher(auth);
            return ResponseEntity.ok(liveLessonService.update(lessonId, request, userId(auth)));
        } catch (Exception error) {
            return errorResponse("updating live lesson", error);
        }
    }

    @DeleteMapping("/{lessonId}")
    @Operation(summary = "Teacher deletes a scheduled or ended live lesson")
    public ResponseEntity<?> delete(@PathVariable String lessonId, Authentication auth) {
        try {
            requireTeacher(auth);
            liveLessonService.delete(lessonId, userId(auth));
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (Exception error) {
            return errorResponse("deleting live lesson", error);
        }
    }

    @PostMapping("/{lessonId}/open")
    @Operation(summary = "Teacher starts the shared video. Students cannot press play.")
    public ResponseEntity<?> open(@PathVariable String lessonId, Authentication auth) {
        try {
            requireTeacher(auth);
            return ResponseEntity.ok(liveLessonService.startPlayback(lessonId, userId(auth)));
        } catch (Exception error) {
            return errorResponse("starting live video", error);
        }
    }

    @PostMapping("/{lessonId}/end")
    public ResponseEntity<?> end(@PathVariable String lessonId, Authentication auth) {
        try {
            requireTeacher(auth);
            return ResponseEntity.ok(liveLessonService.end(lessonId, userId(auth)));
        } catch (Exception error) {
            return errorResponse("ending live lesson", error);
        }
    }

    @GetMapping("/{lessonId}/chat")
    public ResponseEntity<?> chat(@PathVariable String lessonId, Authentication auth) {
        try {
            return ResponseEntity.ok(liveLessonService.listChat(lessonId, userId(auth), role(auth)));
        } catch (Exception error) {
            return errorResponse("loading class chat", error);
        }
    }

    @PostMapping("/{lessonId}/chat")
    public ResponseEntity<?> postChat(
            @PathVariable String lessonId,
            @RequestBody LiveLessonChatMessageRequest request,
            Authentication auth
    ) {
        try {
            String senderName = request != null && request.getSenderName() != null
                    ? request.getSenderName()
                    : userId(auth);
            return ResponseEntity.ok(liveLessonService.postChat(
                    lessonId, request, userId(auth), senderName, role(auth)));
        } catch (Exception error) {
            return errorResponse("sending class chat", error);
        }
    }

    @PostMapping("/{lessonId}/ask-ai")
    @Operation(summary = "Ask the course tutor about this lesson without using the daily 1-1 quota")
    public ResponseEntity<?> askAi(
            @PathVariable String lessonId,
            @RequestBody LiveLessonAiAskRequest request,
            Authentication auth
    ) {
        try {
            return ResponseEntity.ok(liveLessonService.askAi(lessonId, request, userId(auth), role(auth)));
        } catch (Exception error) {
            return errorResponse("asking the lesson tutor", error);
        }
    }

    private void requireTeacher(Authentication auth) {
        String value = role(auth);
        if (!"TEACHER".equals(value) && !"ADMIN".equals(value)) {
            throw new SecurityException("Only a teacher can manage live lessons");
        }
    }

    private static String userId(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new SecurityException("Authentication is required");
        }
        return auth.getName();
    }

    private static String role(Authentication auth) {
        if (auth == null || auth.getAuthorities().isEmpty()) {
            throw new SecurityException("Authentication role is required");
        }
        return auth.getAuthorities().iterator().next().getAuthority().replaceFirst("^ROLE_", "");
    }

    private ResponseEntity<Map<String, String>> errorResponse(String action, Exception error) {
        log.warn("Error {}", action, error);
        if (error instanceof SecurityException) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", error.getMessage()));
        }
        if (error instanceof IllegalArgumentException) {
            return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Failed while " + action));
    }
}
