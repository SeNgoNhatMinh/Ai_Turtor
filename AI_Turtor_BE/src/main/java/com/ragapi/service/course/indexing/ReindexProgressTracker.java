package com.ragapi.service.course.indexing;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory progress for the admin reindex screen. One course is updated at a time. */
@Component
public class ReindexProgressTracker {

    private final ConcurrentHashMap<String, Snapshot> snapshots = new ConcurrentHashMap<>();

    public void start(String courseId, int totalMaterials) {
        snapshots.put(key(courseId), Snapshot.working(Math.max(0, totalMaterials), "PREPARING", "", 0, 0, 0));
    }

    public void beginMaterial(String courseId, int completedMaterials, int totalMaterials, String title) {
        snapshots.put(key(courseId), Snapshot.working(totalMaterials, "DELETING", title, completedMaterials, 0, 0));
    }

    public void onChunk(
            String courseId,
            int completedMaterials,
            int totalMaterials,
            String title,
            CourseMaterialIndexExecutor.IndexProgress progress
    ) {
        int totalChunks = Math.max(0, progress.totalChunks());
        int doneChunks = Math.max(0, progress.completedChunks());
        snapshots.put(key(courseId), Snapshot.working(
                totalMaterials,
                progress.stage(),
                title,
                completedMaterials,
                doneChunks,
                totalChunks
        ));
    }

    public void complete(String courseId) {
        Snapshot current = snapshots.get(key(courseId));
        snapshots.put(key(courseId), current == null ? Snapshot.finished(0) : current.finished());
    }

    public void cancel(String courseId) {
        Snapshot current = snapshots.get(key(courseId));
        snapshots.put(key(courseId), current == null ? Snapshot.cancelled(0) : current.cancelled());
    }

    public void fail(String courseId, String message) {
        Snapshot current = snapshots.get(key(courseId));
        String text = message == null || message.isBlank() ? "Reindex thất bại" : message;
        snapshots.put(key(courseId), current == null ? Snapshot.failed(0, text) : current.failed(text));
    }

    public Map<String, Object> snapshot(String courseId) {
        Snapshot current = snapshots.get(key(courseId));
        if (current == null) {
            return idle(courseId);
        }
        return current.toMap(courseId);
    }

    static int percent(int completedMaterials, int totalMaterials, int completedChunks, int totalChunks) {
        if (totalMaterials <= 0) {
            return 0;
        }
        double fraction = totalChunks <= 0 ? 0 : Math.min(1d, completedChunks / (double) totalChunks);
        int value = (int) Math.floor((completedMaterials + fraction) * 100d / totalMaterials);
        if (completedMaterials >= totalMaterials) {
            return 100;
        }
        return Math.max(0, Math.min(99, value));
    }

    static String stageLabel(String stage) {
        return switch (stage == null ? "" : stage) {
            case "PREPARING" -> "Đang chuẩn bị";
            case "DELETING" -> "Đang xóa chỉ mục cũ";
            case "EXTRACTING_TERMS" -> "Đang tách thuật ngữ";
            case "TRANSLATING" -> "Đang dịch đoạn";
            case "VALIDATING" -> "Đang kiểm tra bản dịch";
            case "EMBEDDING" -> "Đang tạo embedding";
            case "INDEXING" -> "Đang ghi chỉ mục";
            case "VISUAL" -> "Đang lập chỉ mục hình";
            case "OUTLINES" -> "Đang cập nhật mục lục chương";
            case "DONE" -> "Hoàn tất";
            case "FAILED" -> "Thất bại";
            case "CANCELLED" -> "Đã dừng";
            default -> "Đang xử lý";
        };
    }

    private static Map<String, Object> idle(String courseId) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("courseId", courseId);
        response.put("status", "IDLE");
        response.put("percent", 0);
        response.put("stage", "IDLE");
        response.put("stageLabel", "Chưa chạy");
        response.put("materialTitle", "");
        response.put("materialIndex", 0);
        response.put("materialTotal", 0);
        response.put("completedChunks", 0);
        response.put("totalChunks", 0);
        response.put("message", "Chưa có tiến trình reindex");
        return response;
    }

    private static String key(String courseId) {
        return courseId == null ? "" : courseId.trim();
    }

    private record Snapshot(
            String status,
            String stage,
            String materialTitle,
            int completedMaterials,
            int materialTotal,
            int completedChunks,
            int totalChunks,
            String error
    ) {
        private static Snapshot working(
                int materialTotal,
                String stage,
                String materialTitle,
                int completedMaterials,
                int completedChunks,
                int totalChunks
        ) {
            return new Snapshot("PROCESSING", stage, materialTitle == null ? "" : materialTitle,
                    completedMaterials, materialTotal, completedChunks, totalChunks, "");
        }

        private static Snapshot finished(int materialTotal) {
            return new Snapshot("DONE", "DONE", "", materialTotal, materialTotal, 0, 0, "");
        }

        private static Snapshot failed(int materialTotal, String error) {
            return new Snapshot("FAILED", "FAILED", "", 0, materialTotal, 0, 0, error);
        }

        private static Snapshot cancelled(int materialTotal) {
            return new Snapshot("CANCELLED", "CANCELLED", "", 0, materialTotal, 0, 0, "");
        }

        private Snapshot finished() {
            return new Snapshot("DONE", "DONE", materialTitle, materialTotal, materialTotal, completedChunks, totalChunks, "");
        }

        private Snapshot failed(String message) {
            return new Snapshot("FAILED", "FAILED", materialTitle, completedMaterials, materialTotal,
                    completedChunks, totalChunks, message);
        }

        private Snapshot cancelled() {
            return new Snapshot("CANCELLED", "CANCELLED", materialTitle, completedMaterials, materialTotal,
                    completedChunks, totalChunks, "");
        }

        private Map<String, Object> toMap(String courseId) {
            int percent = "DONE".equals(status)
                    ? 100
                    : percent(completedMaterials, materialTotal, completedChunks, totalChunks);
            int shownIndex = "DONE".equals(status)
                    ? materialTotal
                    : Math.min(materialTotal, completedMaterials + (materialTotal == 0 ? 0 : 1));
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("courseId", courseId);
            response.put("status", status);
            response.put("percent", percent);
            response.put("stage", stage);
            response.put("stageLabel", switch (status) {
                case "FAILED" -> stageLabel("FAILED");
                case "CANCELLED" -> stageLabel("CANCELLED");
                default -> stageLabel(stage);
            });
            response.put("materialTitle", materialTitle);
            response.put("materialIndex", shownIndex);
            response.put("materialTotal", materialTotal);
            response.put("completedChunks", completedChunks);
            response.put("totalChunks", totalChunks);
            response.put("message", message(shownIndex));
            return response;
        }

        private String message(int shownIndex) {
            if ("FAILED".equals(status)) {
                return error;
            }
            if ("CANCELLED".equals(status)) {
                return "Đã dừng";
            }
            if ("DONE".equals(status)) {
                return materialTotal == 0
                        ? "Không có tài liệu có nội dung để reindex"
                        : "Đã reindex xong " + materialTotal + " tài liệu";
            }
            StringBuilder text = new StringBuilder();
            if (materialTotal > 0) {
                text.append("Tài liệu ").append(shownIndex).append('/').append(materialTotal);
            } else {
                text.append("Đang chuẩn bị");
            }
            if (!materialTitle.isBlank()) {
                text.append(" · ").append(materialTitle);
            }
            text.append(" · ").append(stageLabel(stage));
            if (totalChunks > 0) {
                text.append(" · ").append(completedChunks).append('/').append(totalChunks).append(" đoạn");
            }
            return text.toString();
        }
    }
}
