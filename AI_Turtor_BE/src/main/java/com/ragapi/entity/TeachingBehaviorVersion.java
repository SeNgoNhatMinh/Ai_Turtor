package com.ragapi.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Snapshot taken before a template change so executions keep their version. */
@Document(collection = "teaching_behavior_versions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeachingBehaviorVersion {
    @Id
    private String id;
    @Indexed
    private String behaviorId;
    private int version;
    private String name;
    private String description;
    private String strategy;
    private String instruction;
    @Builder.Default
    private List<String> supportLevels = new ArrayList<>();
    @Builder.Default
    private List<String> applicableTopics = new ArrayList<>();
    private int priority;
    private String status;
    private String editedBy;
    private LocalDateTime editedAt;
}
