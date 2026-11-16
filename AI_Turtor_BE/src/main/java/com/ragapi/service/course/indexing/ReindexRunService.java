package com.ragapi.service.course.indexing;

import com.ragapi.service.CourseMaterialAccessPolicy;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One background reindex run. Leaving the admin page does not stop it. */
@Service
public class ReindexRunService {

    private final CourseMaterialIndexManagementService materials;
    private final ReindexCancellation cancellation;
    private final ReindexProgressTracker progress;
    private final CourseMaterialAccessPolicy accessPolicy;
    private final ExecutorService workers;
    private final Object lock = new Object();
    private Run run = Run.idle();

    @Autowired
    public ReindexRunService(
            CourseMaterialIndexManagementService materials,
            ReindexCancellation cancellation,
            ReindexProgressTracker progress,
            CourseMaterialAccessPolicy accessPolicy
    ) {
        this(materials, cancellation, progress, accessPolicy, Executors.newSingleThreadExecutor(task -> {
            Thread thread = new Thread(task, "course-reindex");
            thread.setDaemon(true);
            return thread;
        }));
    }

    ReindexRunService(
            CourseMaterialIndexManagementService materials,
            ReindexCancellation cancellation,
            ReindexProgressTracker progress,
            CourseMaterialAccessPolicy accessPolicy,
            ExecutorService workers
    ) {
        this.materials = materials;
        this.cancellation = cancellation;
        this.progress = progress;
        this.accessPolicy = accessPolicy;
        this.workers = workers;
    }

    public Map<String, Object> start(List<String> courseIds, String requesterRole) {
        accessPolicy.requireReindexPermission(requesterRole);
        List<String> ids = clean(courseIds);
        if (ids.isEmpty()) {
            throw new IllegalArgumentException("No courses to reindex");
        }
        synchronized (lock) {
            if (run.active()) {
                return snapshot();
            }
            cancellation.clear();
            run = Run.running(ids);
            String role = requesterRole;
            workers.execute(() -> execute(ids, role));
            return snapshot();
        }
    }

    public Map<String, Object> current(String requesterRole) {
        accessPolicy.requireReindexPermission(requesterRole);
        synchronized (lock) {
            return snapshot();
        }
    }

    public Map<String, Object> stop(String requesterRole) {
        accessPolicy.requireReindexPermission(requesterRole);
        cancellation.requestStop();
        synchronized (lock) {
            if (run.active()) {
                run.status = "STOPPING";
            }
            return snapshot();
        }
    }

    @PreDestroy
    void shutdown() {
        workers.shutdownNow();
    }

    private void execute(List<String> courseIds, String requesterRole) {
        try {
            for (int index = 0; index < courseIds.size(); index++) {
                if (cancellation.isStopRequested()) {
                    cancelFrom(courseIds, index);
                    break;
                }
                String courseId = courseIds.get(index);
                update(courseId, "PROCESSING", "");
                try {
                    Map<String, Object> result = materials.reindexCourse(courseId, requesterRole);
                    int chunks = number(result.get("indexedChunks"));
                    int count = number(result.get("reindexedMaterials"));
                    update(courseId, "DONE", "Đã lập chỉ mục " + chunks + " đoạn từ " + count + " tài liệu");
                } catch (ReindexCancelledException stopped) {
                    update(courseId, "CANCELLED", "Đã dừng");
                    cancelFrom(courseIds, index + 1);
                    break;
                } catch (RuntimeException | IOException error) {
                    String message = error.getMessage() == null || error.getMessage().isBlank()
                            ? "Reindex thất bại"
                            : error.getMessage();
                    update(courseId, "FAILED", message);
                }
            }
        } finally {
            synchronized (lock) {
                run.finish(cancellation.isStopRequested());
            }
        }
    }

    private void cancelFrom(List<String> courseIds, int start) {
        for (int index = start; index < courseIds.size(); index++) {
            update(courseIds.get(index), "CANCELLED", "Đã dừng");
        }
    }

    private void update(String courseId, String status, String message) {
        synchronized (lock) {
            run.update(courseId, status, message);
        }
    }

    private Map<String, Object> snapshot() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", run.status);
        List<Map<String, Object>> courses = new ArrayList<>();
        for (CourseState course : run.courses) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("courseId", course.courseId);
            item.put("status", course.status);
            item.put("message", course.message);
            if ("PROCESSING".equals(course.status)) {
                Map<String, Object> live = progress.snapshot(course.courseId);
                item.put("percent", live.get("percent"));
                item.put("stageLabel", live.get("stageLabel"));
                item.put("message", live.get("message"));
            } else if ("DONE".equals(course.status) || "FAILED".equals(course.status)) {
                item.put("percent", 100);
                item.put("stageLabel", "DONE".equals(course.status) ? "Hoàn tất" : "Thất bại");
            } else if ("CANCELLED".equals(course.status)) {
                item.put("percent", progress.snapshot(course.courseId).getOrDefault("percent", 0));
                item.put("stageLabel", "Đã dừng");
            } else {
                item.put("percent", 0);
                item.put("stageLabel", "Đang chờ");
            }
            courses.add(item);
        }
        response.put("courses", courses);
        return response;
    }

    private static int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static List<String> clean(List<String> courseIds) {
        if (courseIds == null) {
            return List.of();
        }
        return courseIds.stream()
                .map(id -> id == null ? "" : id.trim())
                .filter(id -> !id.isEmpty())
                .distinct()
                .toList();
    }

    private static final class Run {
        private String status;
        private final List<CourseState> courses;

        private Run(String status, List<CourseState> courses) {
            this.status = status;
            this.courses = courses;
        }

        private static Run idle() {
            return new Run("IDLE", List.of());
        }

        private static Run running(List<String> courseIds) {
            List<CourseState> courses = new ArrayList<>();
            for (String courseId : courseIds) {
                courses.add(new CourseState(courseId, "WAITING", ""));
            }
            return new Run("RUNNING", courses);
        }

        private boolean active() {
            return "RUNNING".equals(status) || "STOPPING".equals(status);
        }

        private void update(String courseId, String courseStatus, String message) {
            for (CourseState course : courses) {
                if (course.courseId.equals(courseId)) {
                    course.status = courseStatus;
                    course.message = message == null ? "" : message;
                }
            }
        }

        private void finish(boolean stopped) {
            if (!active() && !"STOPPING".equals(status)) {
                return;
            }
            if (stopped) {
                status = "CANCELLED";
                return;
            }
            boolean failed = false;
            for (CourseState course : courses) {
                if ("FAILED".equals(course.status)) {
                    failed = true;
                }
            }
            status = failed ? "FAILED" : "DONE";
        }
    }

    private static final class CourseState {
        private final String courseId;
        private String status;
        private String message;

        private CourseState(String courseId, String status, String message) {
            this.courseId = courseId;
            this.status = status;
            this.message = message;
        }
    }
}
