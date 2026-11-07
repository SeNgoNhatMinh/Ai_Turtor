package com.ragapi.service.behavior.plan;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.stream.Collectors;

/** Immutable personalization snapshot for one tutor generation request. */
public record TeachingPlan(
        String studentId,
        String courseId,
        String classId,
        String teachingMode,
        String supportLevel,
        StudentLearningProfileSnapshot learnerProfile,
        List<SelectedTeachingBehavior> selectedBehaviors,
        TeacherPolicySnapshot teacherPolicy,
        String explanationDepth,
        String learningPace,
        List<String> requiredTeachingSections,
        List<String> constraints,
        String planFingerprint
) {
    public static TeachingPlan empty(String studentId, String courseId, String classId, String supportLevel) {
        String level = supportLevel == null || supportLevel.isBlank() ? "STANDARD" : supportLevel;
        return new TeachingPlan(
                studentId,
                courseId,
                classId,
                null,
                level,
                StudentLearningProfileSnapshot.EMPTY,
                List.of(),
                new TeacherPolicySnapshot(level, List.of(), false),
                depthFor(level),
                null,
                List.of(),
                List.of(),
                fingerprint(level, List.of(), null, depthFor(level), List.of())
        );
    }

    public boolean hasBehaviors() {
        return selectedBehaviors != null && !selectedBehaviors.isEmpty();
    }

    public boolean isPersonalized() {
        return hasBehaviors()
                || (learnerProfile != null && !learnerProfile.isEmpty())
                || (supportLevel != null && !"STANDARD".equalsIgnoreCase(supportLevel));
    }

    static String depthFor(String supportLevel) {
        if ("HIGH_SUPPORT".equalsIgnoreCase(supportLevel)) return "DETAILED";
        if ("CHALLENGE".equalsIgnoreCase(supportLevel)) return "CONCISE";
        return "BALANCED";
    }

    static String fingerprint(
            String supportLevel,
            List<SelectedTeachingBehavior> behaviors,
            String pace,
            String depth,
            List<String> sections
    ) {
        String payload = String.join("|",
                nullToEmpty(supportLevel),
                nullToEmpty(pace),
                nullToEmpty(depth),
                behaviors == null ? "" : behaviors.stream()
                        .map(b -> b.behaviorId() + ":" + b.behaviorVersion())
                        .collect(Collectors.joining(",")),
                sections == null ? "" : String.join(",", sections)
        );
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (Exception error) {
            return Integer.toHexString(payload.hashCode());
        }
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
