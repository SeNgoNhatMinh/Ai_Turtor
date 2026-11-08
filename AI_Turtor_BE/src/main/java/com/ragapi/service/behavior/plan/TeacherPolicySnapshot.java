package com.ragapi.service.behavior.plan;

import java.util.List;

/** Teacher constraints that outrank student preferences. */
public record TeacherPolicySnapshot(
        String supportLevel,
        List<String> instructions,
        boolean teacherControlled
) {
    public static TeacherPolicySnapshot standard() {
        return new TeacherPolicySnapshot("STANDARD", List.of(), false);
    }
}
