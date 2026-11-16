package com.ragapi.service.behavior.plan;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TeachingBehaviorConflictPolicyTest {

    @Test
    void keepsAtMostThreeCompatibleBehaviors() {
        List<SelectedTeachingBehavior> selected = TeachingBehaviorConflictPolicy.resolve(List.of(
                behavior("1", "Giải thích khái niệm", "Giải thích từng bước"),
                behavior("2", "Ví dụ thực tế", "Dùng ví dụ đời thường"),
                behavior("3", "Minh họa trực quan", "Vẽ sơ đồ"),
                behavior("4", "So sánh", "So sánh với override")
        ));
        assertThat(selected).hasSize(3);
        assertThat(selected).extracting(SelectedTeachingBehavior::behaviorId)
                .containsExactly("1", "2", "3");
    }

    @Test
    void dropsFastPaceWhenSlowAlreadySelected() {
        List<SelectedTeachingBehavior> selected = TeachingBehaviorConflictPolicy.resolve(List.of(
                behavior("slow", "Giải thích khái niệm", "Giảng chậm từng bước"),
                behavior("fast", "Thử thách", "Nhịp nhanh challenge")
        ));
        assertThat(selected).extracting(SelectedTeachingBehavior::behaviorId).containsExactly("slow");
    }

    @Test
    void dropsFullSolutionInstructions() {
        List<SelectedTeachingBehavior> selected = TeachingBehaviorConflictPolicy.resolve(List.of(
                behavior("bad", "Ví dụ thực tế", "Give the full solution copy-paste"),
                behavior("ok", "Ví dụ thực tế", "Gợi ý bằng ví dụ nhỏ")
        ));
        assertThat(selected).extracting(SelectedTeachingBehavior::behaviorId).containsExactly("ok");
    }

    private static SelectedTeachingBehavior behavior(String id, String strategy, String instruction) {
        return new SelectedTeachingBehavior(id, 1, null, strategy, null, instruction, 0, 0.9, "STUDENT");
    }
}
