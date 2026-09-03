package com.ragapi.service;

import com.ragapi.dto.CourseRagAnswer;
import com.ragapi.dto.CreateLiveLessonRequest;
import com.ragapi.dto.UpdateLiveLessonRequest;
import com.ragapi.dto.LiveLessonAiAskRequest;
import com.ragapi.dto.LiveLessonChatMessageRequest;
import com.ragapi.dto.LiveLessonChatMessageResponse;
import com.ragapi.dto.LiveLessonResponse;
import com.ragapi.dto.SyncLivePlaybackRequest;
import com.ragapi.entity.ClassSection;
import com.ragapi.entity.CourseEnrollment;
import com.ragapi.entity.LiveLesson;
import com.ragapi.entity.LiveLessonChatMessage;
import com.ragapi.repository.ClassSectionRepository;
import com.ragapi.repository.CourseEnrollmentRepository;
import com.ragapi.repository.LiveLessonChatMessageRepository;
import com.ragapi.repository.LiveLessonRepository;
import com.ragapi.util.YouTubeVideoUrls;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.ragapi.util.ValidationUtils.STUDENT_QUESTION_MAX_LENGTH;
import static com.ragapi.util.ValidationUtils.requireMaxLength;
import static com.ragapi.util.ValidationUtils.requireText;

@Service
@RequiredArgsConstructor
public class LiveLessonService {

    public static final String STATUS_SCHEDULED = "SCHEDULED";
    public static final String STATUS_LIVE = "LIVE";
    public static final String STATUS_ENDED = "ENDED";
    private static final int DEFAULT_DURATION_MINUTES = 90;
    public static final int NOTIFY_MINUTES_BEFORE = 10;
    private static final int CHAT_LIMIT = 120;
    private static final Set<String> STAFF = Set.of("ADMIN", "SENIOR_MENTOR", "TEACHER");

    private final LiveLessonRepository lessonRepository;
    private final LiveLessonChatMessageRepository chatRepository;
    private final ClassSectionRepository classSectionRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final CourseRagService ragService;
    private final RealtimeEventService realtimeEvents;

    public LiveLessonResponse create(CreateLiveLessonRequest request, String teacherId, String teacherName) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        String courseId = requireText(request.getCourseId(), "courseId");
        String classId = requireText(request.getClassId(), "classId");
        String topic = requireMaxLength(requireText(request.getTopic(), "topic"), "topic", 200);
        String youtubeUrl = requireText(request.getYoutubeUrl(), "youtubeUrl");
        String videoId = YouTubeVideoUrls.requireVideoId(youtubeUrl);
        LocalDateTime startsAt = request.getStartsAt();
        if (startsAt == null) {
            throw new IllegalArgumentException("startsAt is required");
        }
        ClassSection section = classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                .orElseThrow(() -> new IllegalArgumentException("Class section not found"));
        if (!teacherId.equals(section.getTeacherId())) {
            throw new SecurityException("Only the assigned class teacher can schedule a live lesson");
        }
        LocalDateTime endsAt = request.getEndsAt() != null
                ? request.getEndsAt()
                : startsAt.plusMinutes(DEFAULT_DURATION_MINUTES);
        if (!endsAt.isAfter(startsAt)) {
            throw new IllegalArgumentException("endsAt must be after startsAt");
        }
        LocalDateTime now = LocalDateTime.now();
        LiveLesson lesson = LiveLesson.builder()
                .id(UUID.randomUUID().toString())
                .courseId(courseId)
                .courseName(blankTo(section.getCourseName(), courseId))
                .classId(classId)
                .className(blankTo(section.getClassName(), classId))
                .teacherId(teacherId)
                .teacherName(blankTo(teacherName, section.getTeacherName()))
                .topic(topic.trim())
                .youtubeUrl(youtubeUrl.trim())
                .youtubeVideoId(videoId)
                .status(STATUS_SCHEDULED)
                .startsAt(startsAt)
                .endsAt(endsAt)
                .createdAt(now)
                .updatedAt(now)
                .build();
        LiveLesson saved = lessonRepository.save(refreshStatus(lesson, now));
        if (isUpcomingSoon(saved, now)) {
            saved.setStartReminderSentAt(now);
            saved = lessonRepository.save(saved);
        }
        LiveLessonResponse response = toResponse(saved);
        notifyClassStudents(response, "LIVE_LESSON_SCHEDULED", "SCHEDULED");
        return response;
    }

    public LiveLessonResponse update(String lessonId, UpdateLiveLessonRequest request, String teacherId) {
        LiveLesson lesson = requireOwnedLesson(lessonId, teacherId);
        refreshAndSave(lesson, LocalDateTime.now());
        if (!STATUS_SCHEDULED.equals(lesson.getStatus()) || lesson.getPlaybackStartedAt() != null) {
            throw new IllegalArgumentException("Chỉ sửa được buổi live khi chưa bắt đầu video");
        }
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        if (request.getTopic() != null && !request.getTopic().isBlank()) {
            lesson.setTopic(requireMaxLength(request.getTopic().trim(), "topic", 200));
        }
        if (request.getYoutubeUrl() != null && !request.getYoutubeUrl().isBlank()) {
            String videoId = YouTubeVideoUrls.requireVideoId(request.getYoutubeUrl());
            lesson.setYoutubeUrl(request.getYoutubeUrl().trim());
            lesson.setYoutubeVideoId(videoId);
        }
        LocalDateTime previousStart = lesson.getStartsAt();
        boolean rescheduled = false;
        if (request.getStartsAt() != null) {
            lesson.setStartsAt(request.getStartsAt());
            rescheduled = previousStart == null || !previousStart.equals(request.getStartsAt());
            if (rescheduled) {
                lesson.setStartReminderSentAt(null);
            }
        }
        LocalDateTime startsAt = lesson.getStartsAt();
        LocalDateTime endsAt = request.getEndsAt() != null
                ? request.getEndsAt()
                : (lesson.getEndsAt() != null ? lesson.getEndsAt() : startsAt.plusMinutes(DEFAULT_DURATION_MINUTES));
        if (startsAt == null || !endsAt.isAfter(startsAt)) {
            throw new IllegalArgumentException("endsAt must be after startsAt");
        }
        lesson.setEndsAt(endsAt);
        lesson.setUpdatedAt(LocalDateTime.now());
        LiveLessonResponse response = toResponse(lessonRepository.save(lesson));
        if (rescheduled) {
            notifyClassStudents(response, "LIVE_LESSON_SCHEDULED", "SCHEDULED");
        }
        return response;
    }

    public void delete(String lessonId, String teacherId) {
        LiveLesson lesson = requireOwnedLesson(lessonId, teacherId);
        refreshAndSave(lesson, LocalDateTime.now());
        if (STATUS_LIVE.equals(lesson.getStatus())) {
            throw new IllegalArgumentException("Không xóa buổi đang phát. Hãy kết thúc trước.");
        }
        chatRepository.deleteByLessonId(lessonId);
        lessonRepository.delete(lesson);
    }

    public List<LiveLessonResponse> listMine(String userId, String role, String courseId, String classId) {
        String normalizedRole = normalizeRole(role);
        List<LiveLesson> lessons = new ArrayList<>();
        if (courseId != null && !courseId.isBlank() && classId != null && !classId.isBlank()) {
            requireViewer(userId, normalizedRole, courseId, classId, null);
            lessons.addAll(lessonRepository.findByCourseIdAndClassIdOrderByStartsAtDesc(courseId, classId));
        } else if ("TEACHER".equals(normalizedRole)) {
            lessons.addAll(lessonRepository.findByTeacherIdOrderByStartsAtDesc(userId));
        } else if ("STUDENT".equals(normalizedRole)) {
            for (CourseEnrollment enrollment : enrollmentRepository.findByStudentId(userId)) {
                if (enrollment.getCourseId() == null || enrollment.getClassId() == null) {
                    continue;
                }
                lessons.addAll(lessonRepository.findByCourseIdAndClassIdOrderByStartsAtDesc(
                        enrollment.getCourseId(), enrollment.getClassId()));
            }
        } else if (STAFF.contains(normalizedRole)) {
            lessons.addAll(lessonRepository.findAll());
        }
        LocalDateTime now = LocalDateTime.now();
        Map<String, LiveLessonResponse> unique = new LinkedHashMap<>();
        lessons.stream()
                .sorted(Comparator.comparing(LiveLesson::getStartsAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .forEach(lesson -> unique.putIfAbsent(lesson.getId(), toResponse(refreshAndSave(lesson, now))));
        return new ArrayList<>(unique.values());
    }

    public LiveLessonResponse get(String lessonId, String userId, String role) {
        LiveLesson lesson = requireLesson(lessonId);
        requireViewer(userId, role, lesson.getCourseId(), lesson.getClassId(), lesson.getTeacherId());
        return toResponse(refreshAndSave(lesson, LocalDateTime.now()));
    }

    public LiveLessonResponse startPlayback(String lessonId, String teacherId) {
        LiveLesson lesson = requireOwnedLesson(lessonId, teacherId);
        LocalDateTime now = LocalDateTime.now();
        refreshStatus(lesson, now);
        if (STATUS_ENDED.equals(lesson.getStatus())) {
            throw new IllegalArgumentException("This live lesson has already ended");
        }
        boolean firstStart = lesson.getPlaybackStartedAt() == null;
        lesson.setStatus(STATUS_LIVE);
        if (firstStart) {
            lesson.setPlaybackStartedAt(now);
            lesson.setPlaybackPaused(false);
            lesson.setPlaybackPositionSeconds(0d);
            lesson.setPlaybackClockAt(now);
        }
        if (lesson.getEndsAt() == null || !lesson.getEndsAt().isAfter(now)) {
            lesson.setEndsAt(now.plusMinutes(DEFAULT_DURATION_MINUTES));
        }
        lesson.setUpdatedAt(now);
        LiveLessonResponse response = toResponse(lessonRepository.save(lesson));
        if (firstStart) {
            notifyClassStudents(response, "LIVE_LESSON_STARTED", "LIVE");
        }
        return response;
    }

    public LiveLessonResponse syncPlayback(String lessonId, String teacherId, SyncLivePlaybackRequest request) {
        LiveLesson lesson = requireOwnedLesson(lessonId, teacherId);
        LocalDateTime now = LocalDateTime.now();
        refreshStatus(lesson, now);
        if (!STATUS_LIVE.equals(lesson.getStatus()) || lesson.getPlaybackStartedAt() == null) {
            throw new IllegalArgumentException("Hãy bắt đầu video trước khi điều khiển.");
        }
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        double position = request.getPositionSeconds() == null ? 0d : Math.max(0d, request.getPositionSeconds());
        lesson.setPlaybackPaused(Boolean.TRUE.equals(request.getPaused()));
        lesson.setPlaybackPositionSeconds(position);
        lesson.setPlaybackClockAt(now);
        lesson.setUpdatedAt(now);
        LiveLessonResponse response = toResponse(lessonRepository.save(lesson));
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("paused", response.isPlaybackPaused());
        extra.put("playbackPaused", response.isPlaybackPaused());
        extra.put("positionSeconds", response.getPlaybackElapsedSeconds());
        if (response.getPlaybackClockAt() != null) {
            extra.put("playbackClockAt", response.getPlaybackClockAt().toString());
        }
        if (response.getPlaybackClockEpochMs() != null) {
            extra.put("playbackClockEpochMs", response.getPlaybackClockEpochMs());
        }
        notifyLessonRoom(response, "LIVE_LESSON_PLAYBACK", "LIVE", extra);
        return response;
    }

    public void sendUpcomingReminders() {
        LocalDateTime now = LocalDateTime.now();
        List<LiveLesson> scheduled = lessonRepository.findByStatus(STATUS_SCHEDULED);
        if (scheduled == null || scheduled.isEmpty()) {
            return;
        }
        for (LiveLesson lesson : scheduled) {
            try {
                refreshStatus(lesson, now);
                if (!STATUS_SCHEDULED.equals(lesson.getStatus())) {
                    lessonRepository.save(lesson);
                    continue;
                }
                if (!isUpcomingSoon(lesson, now) || lesson.getStartReminderSentAt() != null) {
                    continue;
                }
                lesson.setStartReminderSentAt(now);
                lesson.setUpdatedAt(now);
                LiveLessonResponse response = toResponse(lessonRepository.save(lesson));
                notifyClassStudents(response, "LIVE_LESSON_STARTING", "UPCOMING");
            } catch (Exception ignored) {
                // One bad lesson must not block reminders for the rest of the class.
            }
        }
    }

    public LiveLessonResponse end(String lessonId, String teacherId) {
        LiveLesson lesson = requireOwnedLesson(lessonId, teacherId);
        LocalDateTime now = LocalDateTime.now();
        if (STATUS_LIVE.equals(lesson.getStatus()) && lesson.getPlaybackStartedAt() != null) {
            lesson.setPlaybackPositionSeconds((double) currentPlaybackSeconds(lesson, now));
            lesson.setPlaybackPaused(true);
            lesson.setPlaybackClockAt(now);
        }
        lesson.setStatus(STATUS_ENDED);
        lesson.setEndsAt(now);
        lesson.setUpdatedAt(now);
        return toResponse(lessonRepository.save(lesson));
    }

    public List<LiveLessonChatMessageResponse> listChat(String lessonId, String userId, String role) {
        LiveLesson lesson = requireLesson(lessonId);
        requireViewer(userId, role, lesson.getCourseId(), lesson.getClassId(), lesson.getTeacherId());
        refreshAndSave(lesson, LocalDateTime.now());
        List<LiveLessonChatMessage> messages = chatRepository.findByLessonIdOrderByCreatedAtAsc(lessonId);
        int from = Math.max(0, messages.size() - CHAT_LIMIT);
        return messages.subList(from, messages.size()).stream().map(this::toChatResponse).toList();
    }

    public LiveLessonChatMessageResponse postChat(
            String lessonId,
            LiveLessonChatMessageRequest request,
            String userId,
            String userName,
            String role
    ) {
        LiveLesson lesson = requireLesson(lessonId);
        requireViewer(userId, role, lesson.getCourseId(), lesson.getClassId(), lesson.getTeacherId());
        refreshAndSave(lesson, LocalDateTime.now());
        if (STATUS_ENDED.equals(lesson.getStatus()) && !"TEACHER".equals(normalizeRole(role))) {
            throw new IllegalArgumentException("Buổi live đã kết thúc. Hãy xem lại qua link YouTube giảng viên gửi.");
        }
        String content = requireMaxLength(requireText(request == null ? null : request.getContent(), "content"),
                "content", 2_000);
        LiveLessonChatMessage message = LiveLessonChatMessage.builder()
                .id(UUID.randomUUID().toString())
                .lessonId(lessonId)
                .senderId(userId)
                .senderName(blankTo(userName, userId))
                .senderRole(normalizeRole(role))
                .content(content.trim())
                .createdAt(LocalDateTime.now())
                .build();
        return toChatResponse(chatRepository.save(message));
    }

    public CourseRagAnswer askAi(
            String lessonId,
            LiveLessonAiAskRequest request,
            String userId,
            String role
    ) throws Exception {
        LiveLesson lesson = requireLesson(lessonId);
        requireViewer(userId, role, lesson.getCourseId(), lesson.getClassId(), lesson.getTeacherId());
        refreshAndSave(lesson, LocalDateTime.now());
        String question = requireMaxLength(
                requireText(request == null ? null : request.getQuestion(), "question"),
                "question",
                STUDENT_QUESTION_MAX_LENGTH
        );
        String timestamp = request.getVideoTimestamp() == null ? "" : request.getVideoTimestamp().trim();
        String hint = timestamp.isBlank()
                ? lesson.getTopic()
                : lesson.getTopic() + " (video phút " + timestamp + ")";
        return ragService.askWithConfidence(
                question,
                lesson.getCourseId(),
                lesson.getClassId(),
                "LESSON_TEACH",
                hint
        );
    }

    private LiveLesson requireLesson(String lessonId) {
        return lessonRepository.findById(requireText(lessonId, "lessonId"))
                .orElseThrow(() -> new IllegalArgumentException("Live lesson not found"));
    }

    private LiveLesson requireOwnedLesson(String lessonId, String teacherId) {
        LiveLesson lesson = requireLesson(lessonId);
        if (!teacherId.equals(lesson.getTeacherId())) {
            throw new SecurityException("Only the assigned class teacher can change this live lesson");
        }
        return lesson;
    }

    private void requireViewer(String userId, String role, String courseId, String classId, String teacherId) {
        String normalized = normalizeRole(role);
        if (STAFF.contains(normalized) && !"TEACHER".equals(normalized)) {
            return;
        }
        if ("TEACHER".equals(normalized)) {
            if (userId.equals(teacherId)) {
                return;
            }
            ClassSection section = classSectionRepository.findByCourseIdAndClassId(courseId, classId)
                    .orElseThrow(() -> new SecurityException("Forbidden"));
            if (userId.equals(section.getTeacherId())) {
                return;
            }
            throw new SecurityException("Forbidden");
        }
        enrollmentRepository.findByStudentIdAndCourseIdAndClassId(userId, courseId, classId)
                .orElseThrow(() -> new SecurityException("Forbidden"));
    }

    private LiveLesson refreshAndSave(LiveLesson lesson, LocalDateTime now) {
        String previous = lesson.getStatus();
        refreshStatus(lesson, now);
        if (previous != null && previous.equals(lesson.getStatus())) {
            return lesson;
        }
        return lessonRepository.save(lesson);
    }

    private LiveLesson refreshStatus(LiveLesson lesson, LocalDateTime now) {
        String next = nextStatus(lesson, now);
        if (!next.equals(lesson.getStatus())) {
            lesson.setStatus(next);
            lesson.setUpdatedAt(now);
        }
        return lesson;
    }

    static String nextStatus(LiveLesson lesson, LocalDateTime now) {
        if (lesson == null || now == null) {
            return STATUS_SCHEDULED;
        }
        if (STATUS_ENDED.equals(lesson.getStatus())) {
            return STATUS_ENDED;
        }
        if (lesson.getEndsAt() != null && !now.isBefore(lesson.getEndsAt())) {
            return STATUS_ENDED;
        }
        if (lesson.getPlaybackStartedAt() != null) {
            return STATUS_LIVE;
        }
        return STATUS_SCHEDULED;
    }

    static boolean isUpcomingSoon(LiveLesson lesson, LocalDateTime now) {
        if (lesson == null || now == null || lesson.getStartsAt() == null) {
            return false;
        }
        if (lesson.getPlaybackStartedAt() != null || STATUS_ENDED.equals(lesson.getStatus())) {
            return false;
        }
        LocalDateTime notifyAt = lesson.getStartsAt().minusMinutes(NOTIFY_MINUTES_BEFORE);
        LocalDateTime latestWait = lesson.getEndsAt() == null ? lesson.getStartsAt().plusMinutes(DEFAULT_DURATION_MINUTES) : lesson.getEndsAt();
        return !now.isBefore(notifyAt) && now.isBefore(latestWait);
    }

    static int currentPlaybackSeconds(LiveLesson lesson, LocalDateTime now) {
        if (lesson == null || now == null || lesson.getPlaybackStartedAt() == null) {
            return 0;
        }
        if (lesson.getPlaybackClockAt() != null) {
            double base = lesson.getPlaybackPositionSeconds() == null ? 0d : lesson.getPlaybackPositionSeconds();
            if (Boolean.TRUE.equals(lesson.getPlaybackPaused())) {
                return (int) Math.max(0, Math.floor(base));
            }
            long extra = Math.max(0, Duration.between(lesson.getPlaybackClockAt(), now).getSeconds());
            return (int) Math.max(0, Math.floor(base + extra));
        }
        return (int) Math.max(0, Duration.between(lesson.getPlaybackStartedAt(), now).getSeconds());
    }

    private void notifyClassStudents(LiveLessonResponse lesson, String type, String status) {
        notifyLessonRoom(lesson, type, status, Map.of(), false);
    }

    private void notifyLessonRoom(LiveLessonResponse lesson, String type, String status, Map<String, Object> extra) {
        notifyLessonRoom(lesson, type, status, extra, true);
    }

    private void notifyLessonRoom(
            LiveLessonResponse lesson,
            String type,
            String status,
            Map<String, Object> extra,
            boolean includeTeacher
    ) {
        if (lesson == null || lesson.getCourseId() == null || lesson.getClassId() == null) {
            return;
        }
        List<CourseEnrollment> enrollments = enrollmentRepository.findByCourseIdAndClassId(
                lesson.getCourseId(), lesson.getClassId());
        List<String> recipientIds = new ArrayList<>();
        if (enrollments != null) {
            enrollments.stream()
                    .map(CourseEnrollment::getStudentId)
                    .filter(id -> id != null && !id.isBlank())
                    .distinct()
                    .forEach(recipientIds::add);
        }
        if (includeTeacher && lesson.getTeacherId() != null && !lesson.getTeacherId().isBlank()
                && !recipientIds.contains(lesson.getTeacherId())) {
            recipientIds.add(lesson.getTeacherId());
        }
        if (recipientIds.isEmpty()) {
            return;
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("courseId", lesson.getCourseId());
        data.put("classId", lesson.getClassId());
        data.put("topic", lesson.getTopic() == null ? "" : lesson.getTopic());
        if (lesson.getStartsAt() != null) {
            data.put("startsAt", lesson.getStartsAt().toString());
        }
        data.put("minutesUntilStart", lesson.getMinutesUntilStart());
        data.put("playbackPaused", lesson.isPlaybackPaused());
        data.put("positionSeconds", lesson.getPlaybackElapsedSeconds());
        if (extra != null) {
            data.putAll(extra);
        }
        realtimeEvents.publishToUsers(recipientIds, type, "LIVE_LESSON", lesson.getId(), status, data);
    }

    private LiveLessonResponse toResponse(LiveLesson lesson) {
        LocalDateTime now = LocalDateTime.now();
        boolean playbackActive = lesson.getPlaybackStartedAt() != null && STATUS_LIVE.equals(lesson.getStatus());
        int elapsed = playbackActive ? currentPlaybackSeconds(lesson, now) : 0;
        boolean paused = !playbackActive || Boolean.TRUE.equals(lesson.getPlaybackPaused());
        long minutesUntilStart = 0;
        if (lesson.getStartsAt() != null) {
            minutesUntilStart = Duration.between(now, lesson.getStartsAt()).toMinutes();
        }
        return LiveLessonResponse.builder()
                .id(lesson.getId())
                .courseId(lesson.getCourseId())
                .courseName(lesson.getCourseName())
                .classId(lesson.getClassId())
                .className(lesson.getClassName())
                .teacherId(lesson.getTeacherId())
                .teacherName(lesson.getTeacherName())
                .topic(lesson.getTopic())
                .youtubeUrl(lesson.getYoutubeUrl())
                .youtubeVideoId(lesson.getYoutubeVideoId())
                .embedUrl(YouTubeVideoUrls.embedUrl(lesson.getYoutubeVideoId()))
                .status(lesson.getStatus())
                .startsAt(lesson.getStartsAt())
                .endsAt(lesson.getEndsAt())
                .playbackStartedAt(lesson.getPlaybackStartedAt())
                .playbackActive(playbackActive)
                .playbackElapsedSeconds(elapsed)
                .playbackPaused(paused)
                .playbackClockAt(lesson.getPlaybackClockAt())
                .playbackClockEpochMs(toEpochMs(lesson.getPlaybackClockAt()))
                .upcomingSoon(isUpcomingSoon(lesson, now))
                .minutesUntilStart(minutesUntilStart)
                .build();
    }

    private LiveLessonChatMessageResponse toChatResponse(LiveLessonChatMessage message) {
        return LiveLessonChatMessageResponse.builder()
                .id(message.getId())
                .lessonId(message.getLessonId())
                .senderId(message.getSenderId())
                .senderName(message.getSenderName())
                .senderRole(message.getSenderRole())
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .build();
    }

    private static Long toEpochMs(LocalDateTime value) {
        if (value == null) {
            return null;
        }
        return value.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    private static String normalizeRole(String role) {
        if (role == null) {
            return "";
        }
        return role.trim().toUpperCase(Locale.ROOT).replace("ROLE_", "");
    }

    private static String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
